// Startup decisions that must come out the same in desktop and serve (audit R15); each host
// keeps its own transport and dialogs.
//
// The command lines differ on purpose. Both take `--resume-from <file>` (or `=<file>`), stop
// reading their own flags at `--`, and pass everything else to `git diff`. Beyond that:
//
// | Flag or input                         | Desktop (`self-review`)              | Serve
// (`self-review-serve`)        |
// | ------------------------------------- | ------------------------------------ |
// ---------------------------------- |
// | `--output <file>`, `-o`, `--output=`  | no (save dialog changes the path)    | yes (fixed for
// the process)        |
// | `--help`/`-h`, `--version`/`-v`       | yes                                  | yes
// |
// | forge PR/MR URL as first positional   | yes (remote GUI mode)                | no (passed to
// git)                 |
// | `fetch-comments <url> [--all-threads]`| yes (headless subcommand, args[0])   | no
// |
// | leading Chromium switches             | dropped (the launcher's, not git's)  | n/a
// |
// | nothing to review (`welcome`)         | directory picker                     | startup error
// |

import { resolve } from 'path';
import { isolatedReporter } from './effect-diagnostics';
import type { LoadGitDiffOptions } from './git-diff-loader';
import type { BufferedCommandRunner } from './command-runner';
import { checkLoadingCancelled } from './local-loading-lifetime';
import type { AppConfig, DiffLoadPayload, ReviewSourceIdentity } from './types';
import type { ConfigValueOrigin, LoadedConfig } from './config';
import type { PublishReviewOptions, ReviewOutputTarget } from './review-publisher';
import type { ResolvedAttachmentLocation, AttachmentOrigins } from './attachment-origins';
import {
  findWriteCapableGitDiffOptions,
  formatGitDiffArgs,
  normalizeGitDiffArgs,
  tokenizeGitDiffArgs,
} from './git-diff-args';
import { applyStagedUntrackedDefault } from './staged-untracked';
import { loadGitReviewSnapshot, type GitSnapshotDependencies } from './loaded-git-review';
import { admitSyntheticSnapshot, restrictLoadedReview, type LoadedReview } from './loaded-snapshot';
import { createIgnoreFilter } from './ignore-filter';
import { scanDirectory, scanFile } from './directory-scanner';
import { resolveLocalSourceIdentityAsync } from './source-identity';
import { nodeScanFsLayer } from './node-scan-fs';
import type { ScanFsLayer } from './scan-fs';
import type { StartupSource } from './startup-mode';
import { parseReviewXml } from './xml-parser';
import type { ParsedReview, ReviewXmlReader } from './xml-parser';
import { recordResumedAttachments } from './review-handlers';
import type { ReviewSession } from './review-handlers';

/**
 * A CLI path or the reviewer's user-level `output-file` is explicit and may point anywhere.
 * Project `output-file` or the default is inherited and contained under `cwd`, since a
 * repository could otherwise redirect the save (audit A5).
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

export function publishOptionsFor(
  target: ReviewOutputTarget,
  attachmentOrigins?: AttachmentOrigins
): PublishReviewOptions {
  return target.origin === 'explicit'
    ? { outputOrigin: 'explicit', attachmentOrigins }
    : { outputOrigin: 'inherited', baseDir: target.baseDir, attachmentOrigins };
}

/**
 * Project `default-diff-args` would make git write a file or run a program; thrown before any git
 * command.
 */
export class ConfiguredDiffArgsError extends Error {
  readonly options: readonly string[];
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
  gitDiffArgs: string[];
  origin: 'cli' | ConfigValueOrigin;
  config: AppConfig;
}

/**
 * The CLI's arguments, else `default-diff-args` split with shell quoting. Project-supplied
 * ones are refused with {@link ConfiguredDiffArgsError} if write-capable; the
 * reviewer's own are not.
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
  identity: ReviewSourceIdentity | null;
  /** Host-local capture; optional so original injected loaders remain source compatible. */
  loadedReview?: LoadedReview | null;
}

/** Local source effects. A supplied scan owns paths, enumeration and bounded reads together. */
export interface LocalReviewDependencies {
  scanFs?: ScanFsLayer;
  gitSnapshot?: GitSnapshotDependencies;
}

export interface LocalReviewLoadOptions extends LoadGitDiffOptions {
  /** Binary blob runner belonging to a supplied Git source. */
  snapshotRunner?: BufferedCommandRunner;
}

/**
 * Diagnostics ride on the payload and go to `log`, so a failed load never reads as empty. A welcome
 * source yields no identity.
 */
export async function loadLocalReview(
  source: StartupSource,
  gitDiffArgs: readonly string[],
  config: Pick<AppConfig, 'ignore'>,
  cwd: string,
  log: (message: string) => void,
  options: LocalReviewLoadOptions = {},
  dependencies: LocalReviewDependencies = {}
): Promise<LoadedLocalReview> {
  log = isolatedReporter(log);
  const checkCancelled = () => checkLoadingCancelled(options.signal);
  checkCancelled();
  if (source.mode === 'git') {
    const shouldKeep = createIgnoreFilter(config.ignore);
    const { files, repository, diagnostics, identity, loadedReview } = await loadGitReviewSnapshot(
      [...gitDiffArgs],
      cwd,
      { ...options, shouldKeep },
      dependencies.gitSnapshot
    );
    checkCancelled();
    for (const diagnostic of diagnostics) log(`Diff diagnostic: ${diagnostic}`);
    checkCancelled();
    const keptFiles = files.filter(f => shouldKeep(f.newPath || f.oldPath));
    return {
      payload: {
        files: keptFiles,
        source: {
          type: 'git',
          // Quoted so the argv is recoverable exactly from the document's git-diff-args.
          gitDiffArgs: formatGitDiffArgs([...gitDiffArgs]),
          repository,
        },
        ...(diagnostics.length > 0 ? { diagnostics } : {}),
      },
      identity,
      loadedReview: loadedReview ? restrictLoadedReview(loadedReview, keptFiles) : undefined,
    };
  }

  if (source.mode === 'file' || source.mode === 'directory') {
    const scanFs = dependencies.scanFs ?? nodeScanFsLayer;
    const scanOptions = {
      scanFs,
      budgets: options.budgets,
      signal: options.signal,
      reportDiagnostic: log,
    };
    const scan =
      source.mode === 'file'
        ? await scanFile(source.sourcePath, scanOptions)
        : await scanDirectory(source.sourcePath, config.ignore, scanOptions);
    checkCancelled();
    for (const diagnostic of scan.diagnostics) log(`Diff diagnostic: ${diagnostic}`);
    checkCancelled();
    const identity = await resolveLocalSourceIdentityAsync(
      {
        type: source.mode,
        sourcePath: source.sourcePath,
        invocationCwd: dependencies.scanFs ? cwd : undefined,
      },
      scanFs,
      options.signal
    );
    checkCancelled();
    const loadedReview = admitSyntheticSnapshot(identity, scan.files);
    return {
      payload: {
        files: scan.files,
        source: { type: source.mode, sourcePath: source.sourcePath },
        ...(scan.diagnostics.length > 0 ? { diagnostics: scan.diagnostics } : {}),
      },
      identity,
      loadedReview,
    };
  }

  return { payload: { files: [], source: { type: 'welcome' } }, identity: null };
}

/**
 * Throws `ReviewXmlError` for an unreadable document. Returns it for what the host still needs (the
 * remote head, for drift).
 */
export interface ResumeDocumentOptions extends ResolvedAttachmentLocation {
  reader?: ReviewXmlReader;
  signal?: AbortSignal;
}

export function loadResumeDocument(
  session: ReviewSession,
  resumePath: string,
  options: ResumeDocumentOptions
): ParsedReview;
export function loadResumeDocument(session: ReviewSession, resumePath: string): ParsedReview;
export function loadResumeDocument(
  session: ReviewSession,
  resumePath: string,
  options: ResumeDocumentOptions | undefined = undefined
): ParsedReview {
  options?.signal?.throwIfAborted();
  let parsed: ParsedReview;
  try {
    parsed = parseReviewXml(resumePath, options);
  } catch (error) {
    options?.signal?.throwIfAborted();
    throw error;
  }
  return options === undefined
    ? adoptResumeDocument(session, parsed, resumePath)
    : adoptResumeDocument(session, parsed, resumePath, options);
}

/** Adopt an already parsed document, retaining the same attachment provenance as sync loading. */
export function adoptResumeDocument(
  session: ReviewSession,
  parsed: ParsedReview,
  resumePath: string,
  options: ResolvedAttachmentLocation & { signal?: AbortSignal }
): ParsedReview;
export function adoptResumeDocument(
  session: ReviewSession,
  parsed: ParsedReview,
  resumePath: string
): ParsedReview;
export function adoptResumeDocument(
  session: ReviewSession,
  parsed: ParsedReview,
  resumePath: string,
  options: (ResolvedAttachmentLocation & { signal?: AbortSignal }) | undefined = undefined
): ParsedReview {
  options?.signal?.throwIfAborted();
  const attachments = { attachmentOrigins: session.attachmentOrigins };
  const attachmentDiagnostics =
    options === undefined
      ? recordResumedAttachments(attachments, parsed.comments, resumePath)
      : recordResumedAttachments(attachments, parsed.comments, resumePath, options);
  options?.signal?.throwIfAborted();
  session.attachmentOrigins = attachments.attachmentOrigins;
  session.resumeComments = parsed.comments;
  session.resumeViewedFiles = parsed.viewedFiles;
  session.resumeImportDiagnostics = [...parsed.importDiagnostics, ...attachmentDiagnostics];
  return parsed;
}
