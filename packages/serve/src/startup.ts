// Resolve one review session the way the desktop does. Each phase below cites
// the phase of `initializeApp` (src/main/main.ts) it mirrors.
//
// Two orderings are load-bearing: everything resolves before the caller opens
// the listener, so no request races a half-built session; and the guide lands
// on the session during startup, since `GET /api/diff` answers from there.
//
// The desktop's large-payload prompt and directory picker are native dialogs
// with no browser equivalent, so the first becomes automatic and the second
// becomes a startup error.

import { resolve } from 'node:path';
import {
  applyStagedUntrackedDefault,
  checkWritability,
  commitDiffData,
  computePayloadStats,
  countTotalLines,
  createIgnoreFilter,
  createReviewSession,
  determineMode,
  loadConfig,
  loadGitDiffWithUntracked,
  loadGuide,
  normalizeGitDiffArgs,
  parseReviewXml,
  scanDirectory,
  scanFile,
} from '@self-review/core';
import type { AppConfig, DiffLoadPayload, ReviewSession } from '@self-review/core';
import type { ServeArgs } from './args';
import type { ReviewOutputTarget } from './server';

export interface ServeStartup {
  /** The resolved session, complete: diff, guide, config and resume state. */
  session: ReviewSession;
  /**
   * Root every request-supplied path is contained under: the same value core
   * resolves against, since containment guarantees nothing unless they agree.
   */
  repositoryRoot: string;
  /**
   * Where the review is published, fixed for the lifetime of the process:
   * the absolute path, and whether `--output` named it (`explicit`) or the
   * project configuration or default did (`inherited`, contained under the
   * launch directory by the publisher).
   */
  output: ReviewOutputTarget;
}

/**
 * Mirrors main.ts phase 4. Welcome mode diverges: there is no directory picker
 * in a browser, so refusing beats serving an interface whose controls are dead.
 */
async function loadDiffForMode(gitDiffArgs: string[], config: AppConfig): Promise<DiffLoadPayload> {
  const mode = determineMode(gitDiffArgs);
  console.error(`[serve] Startup mode: ${mode}`);

  if (mode === 'git') {
    const { files, repository, diagnostics } = await loadGitDiffWithUntracked(gitDiffArgs);
    for (const diagnostic of diagnostics) {
      console.error(`[serve] Diff diagnostic: ${diagnostic}`);
    }
    const shouldKeep = createIgnoreFilter(config.ignore);
    return {
      files: files.filter(f => shouldKeep(f.newPath || f.oldPath)),
      source: { type: 'git', gitDiffArgs: gitDiffArgs.join(' '), repository },
      // Carried only when something could not be loaded faithfully, so the
      // browser never mistakes a failed load for "no changes".
      ...(diagnostics.length > 0 ? { diagnostics } : {}),
    };
  }

  if (mode === 'file') {
    const fileArg = gitDiffArgs.find(a => a !== '--' && !a.startsWith('-'))!;
    const sourcePath = resolve(process.cwd(), fileArg);
    return withScanDiagnostics(await scanFile(sourcePath), { type: 'file', sourcePath });
  }

  if (mode === 'directory') {
    const dirArg = gitDiffArgs.find(a => a !== '--' && !a.startsWith('-'))!;
    const sourcePath = resolve(process.cwd(), dirArg);
    return withScanDiagnostics(await scanDirectory(sourcePath, config.ignore), {
      type: 'directory',
      sourcePath,
    });
  }

  throw new Error(
    'Nothing to review: this is not a git repository and no path was given. ' +
      'Run self-review-serve inside a git repository, or pass a directory or file to review.'
  );
}

/**
 * A directory or file scan as a payload. Its diagnostics ride along so the
 * browser shows a budget or read failure instead of an empty review.
 */
function withScanDiagnostics(
  scan: { files: DiffLoadPayload['files']; diagnostics: string[] },
  source: DiffLoadPayload['source']
): DiffLoadPayload {
  for (const diagnostic of scan.diagnostics) {
    console.error(`[serve] Diff diagnostic: ${diagnostic}`);
  }
  return {
    files: scan.files,
    source,
    ...(scan.diagnostics.length > 0 ? { diagnostics: scan.diagnostics } : {}),
  };
}

/** The root core resolves a diff path against — see `ServeStartup.repositoryRoot`. */
function containmentRoot(payload: DiffLoadPayload): string {
  return payload.source.type === 'git' ? payload.source.repository : process.cwd();
}

/**
 * Resolve the session to serve. Throws when there is nothing to review or the
 * resume file cannot be read; the caller reports and exits.
 */
export async function resolveSession(args: ServeArgs): Promise<ServeStartup> {
  // Phase 2 (main.ts:163) — configuration and the output path. Fixed here
  // and never again: no route changes it.
  let config = loadConfig();
  const cwd = process.cwd();
  const outputPath = resolve(cwd, args.outputPath ?? config.outputFile);
  // Which of the two named it decides how far the publisher trusts it: a
  // committed configuration file must not be able to redirect the save.
  const output: ReviewOutputTarget =
    args.outputPath !== null
      ? { path: outputPath, origin: 'explicit' }
      : { path: outputPath, origin: 'inherited', baseDir: cwd };
  // A startup hint, not the guarantee: the publisher reports what actually
  // goes wrong at submit time, and the browser keeps the review for a retry.
  // Refusing an obviously unwritable path here still beats serving one.
  if (!checkWritability(outputPath)) {
    throw new Error(
      `Output path is not writable: ${outputPath}. ` +
        'Pass a writable path with --output, or set output-file in .self-review.yaml.'
    );
  }
  console.error(`[serve] Output path: ${outputPath}`);

  // Phase 3 (main.ts:169) — git diff arguments, normalized so a path can
  // never be read as a revision, then the staged/untracked default.
  let gitDiffArgs = args.gitDiffArgs;
  if (gitDiffArgs.length === 0 && config.defaultDiffArgs) {
    gitDiffArgs = config.defaultDiffArgs.split(' ').filter(a => a.length > 0);
  }
  gitDiffArgs = normalizeGitDiffArgs(gitDiffArgs);
  config = applyStagedUntrackedDefault(config, gitDiffArgs);

  // Phase 4 (main.ts:189) — what to review.
  const diffData = await loadDiffForMode(gitDiffArgs, config);
  console.error(`[serve] Loaded ${diffData.files.length} files`);

  // Phase 4b (main.ts:264) — large payload. The desktop asks; there is
  // nobody to ask before the browser connects, so the threshold simply
  // turns on lazy per-file loading (GET /api/file) and says so.
  const stats = computePayloadStats(diffData.files.length, countTotalLines(diffData.files), config);
  if (stats.exceedsAny) {
    console.error(
      `[serve] Large payload: ${stats.fileCount} files, ${stats.totalLines} lines ` +
        `(thresholds ${config.maxFiles} files, ${config.maxTotalLines} lines) — ` +
        'serving file contents on demand'
    );
    diffData.isLargePayload = true;
  }

  // Phase 5 (main.ts:295) — resume a prior review.
  const session = createReviewSession();
  if (args.resumeFrom) {
    const resumePath = resolve(process.cwd(), args.resumeFrom);
    let parsed: ReturnType<typeof parseReviewXml>;
    try {
      parsed = parseReviewXml(resumePath);
    } catch (error) {
      throw new Error(
        `Could not read the resume file ${resumePath}: ` +
          (error instanceof Error ? error.message : String(error))
      );
    }
    session.resumeComments = parsed.comments;
    session.resumeViewedFiles = parsed.viewedFiles;
    session.resumeImportDiagnostics = parsed.importDiagnostics;
    console.error(
      `[serve] Resumed ${parsed.comments.length} comments and ` +
        `${parsed.viewedFiles.length} viewed files from ${resumePath}`
    );
    for (const diagnostic of parsed.importDiagnostics) {
      console.error(`[serve] Resume import: ${diagnostic}`);
    }
  }

  // Phase 5b (main.ts:337) — the walkthrough guide sidecar, discovered next
  // to the output path. Tolerant by contract: loadGuide never throws.
  const guideData = await loadGuide(
    outputPath,
    config,
    diffData.files.map(f => f.newPath || f.oldPath)
  );
  if (guideData) {
    console.error(`[serve] Walkthrough guide loaded: ${guideData.groups.length} groups`);
  }

  // Phase 6 (main.ts:350) — assemble. Everything the routes read is on the
  // session before the caller opens the listener.
  // Committed through core so the session's reviewed paths, which authorize
  // every apply, are captured from this diff.
  commitDiffData(session, diffData);
  session.guideData = guideData;
  session.config = config;
  // Writable as far as startup could tell: it refused above if it was not.
  session.outputPathInfo = { resolvedOutputPath: outputPath, outputPathWritable: true };

  return { session, repositoryRoot: containmentRoot(diffData), output };
}
