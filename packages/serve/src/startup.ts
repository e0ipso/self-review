// Startup: resolve one review session, exactly the way the desktop application
// resolves its own.
//
// The desktop's sequence is `initializeApp` in src/main/main.ts; every phase
// below cites the phase it mirrors. Two orderings in it are load-bearing here
// and are the reason this is a module rather than a few lines in the entry
// point:
//
//  - Everything is resolved before the listener opens. The listener is opened
//    by the caller, with what this function returns, so an early request can
//    never race a half-built session.
//  - The guide is discovered and put on the session during startup, not after.
//    `GET /api/diff` answers with whatever `getDiffLoad` finds there, so a
//    guide loaded later is a guide no client ever sees.
//
// What the desktop does here that this cannot: the large-payload prompt and
// the welcome screen's directory picker are native dialogs. Neither has a
// browser equivalent, so the first becomes an automatic decision and the
// second becomes a startup error.

import { resolve } from 'node:path';
import {
  applyStagedUntrackedDefault,
  checkWritability,
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

export interface ServeStartup {
  /** The resolved session, complete: diff, guide, config and resume state. */
  session: ReviewSession;
  /**
   * Root every request-supplied path is contained under. This is the value
   * core itself resolves relative paths against — the diff's repository in
   * git mode, the working directory otherwise (see `loadImage`) — because
   * containment only guarantees anything when both agree.
   */
  repositoryRoot: string;
  /** Absolute output path, fixed for the lifetime of the process. */
  outputPath: string;
}

/**
 * Build the diff payload for the detected mode. Mirrors main.ts phase 4.
 *
 * Welcome mode is the one divergence: the desktop opens a window with a
 * directory picker, and there is no such picker here — the browser client
 * cannot open a native dialog and no route offers one. Refusing with a
 * message is better than serving an interface whose only control is dead.
 */
async function loadDiffForMode(
  gitDiffArgs: string[],
  config: AppConfig
): Promise<DiffLoadPayload> {
  const mode = determineMode(gitDiffArgs);
  console.error(`[serve] Startup mode: ${mode}`);

  if (mode === 'git') {
    const { files, repository } = await loadGitDiffWithUntracked(gitDiffArgs);
    const shouldKeep = createIgnoreFilter(config.ignore);
    return {
      files: files.filter(f => shouldKeep(f.newPath || f.oldPath)),
      source: { type: 'git', gitDiffArgs: gitDiffArgs.join(' '), repository },
    };
  }

  if (mode === 'file') {
    const fileArg = gitDiffArgs.find(a => a !== '--' && !a.startsWith('-'))!;
    const sourcePath = resolve(process.cwd(), fileArg);
    return { files: await scanFile(sourcePath), source: { type: 'file', sourcePath } };
  }

  if (mode === 'directory') {
    const dirArg = gitDiffArgs.find(a => a !== '--' && !a.startsWith('-'))!;
    const sourcePath = resolve(process.cwd(), dirArg);
    return {
      files: await scanDirectory(sourcePath, config.ignore),
      source: { type: 'directory', sourcePath },
    };
  }

  throw new Error(
    'Nothing to review: this is not a git repository and no path was given. ' +
      'Run self-review-serve inside a git repository, or pass a directory or file to review.'
  );
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
  const outputPath = resolve(process.cwd(), args.outputPath ?? config.outputFile);
  // Refuse rather than serve. The desktop reaches the same disabled Finish
  // button but offers a native save dialog as the way out; `changeOutputPath`
  // is deliberately absent from the serve adapter, so the browser has no such
  // control and the reviewer would have no exit at all. Better to fail here
  // than an hour into a review that was never going to be saveable.
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
  const stats = computePayloadStats(
    diffData.files.length,
    countTotalLines(diffData.files),
    config
  );
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
    console.error(
      `[serve] Resumed ${parsed.comments.length} comments and ` +
        `${parsed.viewedFiles.length} viewed files from ${resumePath}`
    );
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
  session.diffData = diffData;
  session.guideData = guideData;
  session.config = config;
  // Always writable: startup refused above if it was not, so the renderer's
  // not-writable branch is unreachable here by construction.
  session.outputPathInfo = { resolvedOutputPath: outputPath, outputPathWritable: true };

  return { session, repositoryRoot: containmentRoot(diffData), outputPath };
}
