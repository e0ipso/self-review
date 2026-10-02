// packages/core/src/startup.ts
// The startup steps the desktop (src/main/main.ts) and serve
// (packages/serve/src/startup.ts) front ends share: which output path a
// review publishes to and how far it is trusted, which `git diff` arguments
// it runs and whether a committed configuration may supply them, what the
// arguments review, and how a prior review is resumed into a session.
//
// Each host still owns its transport and its dialogs — the desktop asks
// before a large review and offers a directory picker where serve refuses;
// the desktop can change the output path from a save dialog where serve
// fixes it for the life of the process — so what lives here is the handful
// of decisions that have to come out the same way in both (audit R15), not
// a startup framework.
//
// The two command lines differ on purpose. Both take `--resume-from <file>`
// (also `--resume-from=<file>`), stop reading their own flags at `--`, and
// pass everything else to `git diff`, including an option's separate value
// whatever it looks like. Beyond that:
//
// | Flag or input                         | Desktop (`self-review`)              | Serve (`self-review-serve`)        |
// | ------------------------------------- | ------------------------------------ | ---------------------------------- |
// | `--output <file>`, `-o`, `--output=`  | no (save dialog changes the path)    | yes (fixed for the process)        |
// | `--help`/`-h`, `--version`/`-v`       | yes                                  | yes                                |
// | forge PR/MR URL as first positional   | yes (remote GUI mode)                | no (passed to git)                 |
// | `fetch-comments <url> [--all-threads]`| yes (headless subcommand, args[0])   | no                                 |
// | leading Chromium switches             | dropped (the launcher's, not git's)  | n/a                                |
// | nothing to review (`welcome`)         | directory picker                     | startup error                      |

import { resolve } from 'path';
import type { AppConfig, DiffLoadPayload, ReviewSourceIdentity } from './types';
import type { ConfigValueOrigin, LoadedConfig } from './config';
import type { PublishReviewOptions, ReviewOutputTarget } from './review-publisher';
import type { AttachmentOrigins } from './attachment-origins';
import {
  findWriteCapableGitDiffOptions,
  formatGitDiffArgs,
  normalizeGitDiffArgs,
  tokenizeGitDiffArgs,
} from './git-diff-args';
import { applyStagedUntrackedDefault } from './staged-untracked';
import { loadGitDiffWithUntracked } from './git-diff-loader';
import { createIgnoreFilter } from './ignore-filter';
import { scanDirectory, scanFile } from './directory-scanner';
import { resolveLocalSourceIdentity } from './source-identity';
import type { StartupSource } from './startup-mode';
import { parseReviewXml } from './xml-parser';
import type { ParsedReview } from './xml-parser';
import { recordResumedAttachments } from './review-handlers';
import type { ReviewSession } from './review-handlers';

/**
 * Where the review is published and how far the publisher trusts the path.
 *
 * A path the reviewer named — `explicitPath` from a CLI flag — is explicit
 * and may point anywhere. So is `output-file` from the reviewer's own
 * user-level configuration: it is their intent, and it commonly names a
 * directory outside the repository. Only `output-file` from the project's
 * committed `.self-review.yaml`, or the built-in default, is inherited and
 * contained under the launch directory `cwd`, since a repository could
 * otherwise redirect the save (audit A5).
 */
export function resolveOutputTarget(
  explicitPath: string | null,
  loaded: LoadedConfig,
  cwd: string
): ReviewOutputTarget {
  if (explicitPath !== null) {
    return { path: resolve(cwd, explicitPath), origin: 'explicit' };
  }
  const path = resolve(cwd, loaded.config.outputFile);
  if (loaded.provenance.outputFile === 'user') {
    return { path, origin: 'explicit' };
  }
  return { path, origin: 'inherited', baseDir: cwd };
}

/** The publisher options for `target`; see `PublishReviewOptions`. */
export function publishOptionsFor(
  target: ReviewOutputTarget,
  attachmentOrigins?: AttachmentOrigins
): PublishReviewOptions {
  return target.origin === 'explicit'
    ? { outputOrigin: 'explicit', attachmentOrigins }
    : { outputOrigin: 'inherited', baseDir: target.baseDir, attachmentOrigins };
}

/**
 * Project configuration supplied `default-diff-args` that would make git
 * write a file or run an external program. Thrown before any git command
 * runs; the host reports it and does not start the review.
 */
export class ConfiguredDiffArgsError extends Error {
  /** The offending options, as written. */
  readonly options: readonly string[];
  /** The configuration file they came from. */
  readonly configPath: string;

  constructor(options: readonly string[], configPath: string) {
    super(
      `Refusing default-diff-args from ${configPath}: ${options.join(' ')} ` +
        'would make git write a file or run an external program. A committed project ' +
        'configuration may not supply such options; pass them on the command line instead.'
    );
    this.name = 'ConfiguredDiffArgsError';
    this.options = [...options];
    this.configPath = configPath;
  }
}

export interface ResolvedDiffArgs {
  /** The arguments to run, normalized so a path is never read as a revision. */
  gitDiffArgs: string[];
  /** Who supplied them: the command line, or the configuration file (or default) that did. */
  origin: 'cli' | ConfigValueOrigin;
  /** The configuration with the staged/untracked default applied for these arguments. */
  config: AppConfig;
}

/**
 * The `git diff` arguments a review runs: the command line's when it gave
 * any, else the configured `default-diff-args` split with shell quoting so
 * `-S "a b"` stays one argument. Arguments a committed project
 * configuration supplies are checked for write-capable and
 * external-execution options first and refused with
 * {@link ConfiguredDiffArgsError}; the reviewer's own arguments, typed or
 * from their user-level configuration, are not restricted here.
 */
export function resolveStartupDiffArgs(
  cliGitDiffArgs: readonly string[],
  loaded: LoadedConfig,
  cwd: string
): ResolvedDiffArgs {
  let gitDiffArgs = [...cliGitDiffArgs];
  let origin: ResolvedDiffArgs['origin'] = 'cli';
  if (gitDiffArgs.length === 0 && loaded.config.defaultDiffArgs) {
    gitDiffArgs = tokenizeGitDiffArgs(loaded.config.defaultDiffArgs);
    origin = loaded.provenance.defaultDiffArgs;
    if (origin === 'project') {
      const offending = findWriteCapableGitDiffOptions(gitDiffArgs);
      if (offending.length > 0) {
        const source = loaded.sources.find(s => s.origin === 'project');
        throw new ConfiguredDiffArgsError(offending, source?.path ?? '.self-review.yaml');
      }
    }
  }
  gitDiffArgs = normalizeGitDiffArgs(gitDiffArgs, cwd);
  return {
    gitDiffArgs,
    origin,
    config: applyStagedUntrackedDefault(loaded.config, gitDiffArgs),
  };
}

export interface LoadedLocalReview {
  payload: DiffLoadPayload;
  /** What the payload reviews; null only for a welcome payload. */
  identity: ReviewSourceIdentity | null;
}

/**
 * Load what `source` names, from the launch directory `cwd`: the git diff
 * (filtered by the configured ignore patterns, with the argv recorded in a
 * form `tokenizeGitDiffArgs` recovers exactly), the scanned directory, or
 * the scanned file. Diagnostics ride on the payload and go to `log`, so a
 * failed or partial load never reads as an empty review. A welcome source
 * yields an empty payload with no identity; the host decides what that
 * means.
 */
export async function loadLocalReview(
  source: StartupSource,
  gitDiffArgs: readonly string[],
  config: AppConfig,
  cwd: string,
  log: (message: string) => void
): Promise<LoadedLocalReview> {
  if (source.mode === 'git') {
    const { files, repository, diagnostics, identity } = await loadGitDiffWithUntracked(
      [...gitDiffArgs],
      cwd
    );
    for (const diagnostic of diagnostics) log(`Diff diagnostic: ${diagnostic}`);
    const shouldKeep = createIgnoreFilter(config.ignore);
    return {
      payload: {
        files: files.filter(f => shouldKeep(f.newPath || f.oldPath)),
        source: {
          type: 'git',
          // Quoted where a bare join would lose a boundary, so the argv can be
          // recovered exactly from the document's git-diff-args attribute.
          gitDiffArgs: formatGitDiffArgs([...gitDiffArgs]),
          repository,
        },
        ...(diagnostics.length > 0 ? { diagnostics } : {}),
      },
      identity,
    };
  }

  if (source.mode === 'file' || source.mode === 'directory') {
    const scan =
      source.mode === 'file'
        ? await scanFile(source.sourcePath)
        : await scanDirectory(source.sourcePath, config.ignore);
    for (const diagnostic of scan.diagnostics) log(`Diff diagnostic: ${diagnostic}`);
    return {
      payload: {
        files: scan.files,
        source: { type: source.mode, sourcePath: source.sourcePath },
        ...(scan.diagnostics.length > 0 ? { diagnostics: scan.diagnostics } : {}),
      },
      identity: resolveLocalSourceIdentity({ type: source.mode, sourcePath: source.sourcePath }),
    };
  }

  return { payload: { files: [], source: { type: 'welcome' } }, identity: null };
}

/**
 * Resume a prior review into `session`: its comments, viewed files and
 * import diagnostics, with the attachments recorded as living beside the
 * resumed document rather than the launch directory or the output. Throws
 * the parser's `ReviewXmlError` when the document cannot be read; the host
 * reports it. Returns the parsed document for what the host still needs
 * from it (the recorded remote head, for drift).
 */
export function loadResumeDocument(session: ReviewSession, resumePath: string): ParsedReview {
  const parsed = parseReviewXml(resumePath);
  session.resumeComments = parsed.comments;
  session.resumeViewedFiles = parsed.viewedFiles;
  session.resumeImportDiagnostics = [
    ...parsed.importDiagnostics,
    ...recordResumedAttachments(session, parsed.comments, resumePath),
  ];
  return parsed;
}
