// Resolve one review session the way the desktop does. Each phase below cites
// the phase of `initializeApp` (src/main/main.ts) it mirrors; the shared decisions are core's startup module.
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
  commitDiffData,
  computePayloadStats,
  countTotalLines,
  createReviewSession,
  inspectOutputPath,
  loadConfigWithProvenance,
  loadGuide,
  loadLocalReview,
  loadResumeDocument,
  publishOptionsFor,
  resolveOutputTarget,
  resolveStartupDiffArgs,
  resolveStartupSource,
} from '@self-review/core';
import type { ReviewOutputTarget, ReviewSession } from '@self-review/core';
import type { ServeArgs } from './args';

export interface ServeStartup {
  /** Carries the source identity every path-taking route authorizes against (audit A6). */
  session: ReviewSession;
  /** Fixed for the process lifetime. */
  output: ReviewOutputTarget;
}

const log = (message: string) => console.error(`[serve] ${message}`);

/** Throws when startup cannot produce a servable session; the caller reports and exits. */
export async function resolveSession(args: ServeArgs): Promise<ServeStartup> {
  // Phase 2 (main.ts): configuration and the output path.
  const cwd = process.cwd();
  const loadedConfig = loadConfigWithProvenance({ cwd });
  const output = resolveOutputTarget(args.outputPath, loadedConfig, cwd);
  // Advisory (the publisher re-checks at submit), but refusing an output that can never be written beats serving a review with no way out.
  const problem = inspectOutputPath(output.path, publishOptionsFor(output));
  if (problem) {
    throw new Error(
      `Output path is not writable (${problem.code}): ${problem.message} ` +
        'Pass a writable path with --output, or set output-file in .self-review.yaml.'
    );
  }
  log(`Output path: ${output.path} (${output.origin})`);

  // Phase 3 (main.ts): git diff arguments.
  const { gitDiffArgs, config } = resolveStartupDiffArgs(args.gitDiffArgs, loadedConfig, cwd);

  // Phase 4 (main.ts): what to review. Welcome mode is refused: a browser has no directory picker.
  const source = resolveStartupSource(gitDiffArgs, cwd);
  log(`Startup mode: ${source.mode}`);
  if (source.mode === 'welcome') {
    throw new Error(
      'Nothing to review: this is not a git repository and no path was given. ' +
        'Run self-review-serve inside a git repository, or pass a directory or file to review.'
    );
  }
  const { payload: diffData, identity } = await loadLocalReview(
    source,
    gitDiffArgs,
    config,
    cwd,
    log
  );
  log(`Loaded ${diffData.files.length} files`);

  // Phase 4b (main.ts): large payload. Nobody to ask before the browser connects, so lazy loading just turns on.
  const stats = computePayloadStats(diffData.files.length, countTotalLines(diffData.files), config);
  if (stats.exceedsAny) {
    log(
      `Large payload: ${stats.fileCount} files, ${stats.totalLines} lines ` +
        `(thresholds ${config.maxFiles} files, ${config.maxTotalLines} lines) — ` +
        'serving file contents on demand'
    );
    diffData.isLargePayload = true;
  }

  // Phase 5 (main.ts): resume.
  const session = createReviewSession();
  if (args.resumeFrom) {
    const resumePath = resolve(cwd, args.resumeFrom);
    try {
      loadResumeDocument(session, resumePath);
    } catch (error) {
      throw new Error(
        `Could not read the resume file ${resumePath}: ` +
          (error instanceof Error ? error.message : String(error))
      );
    }
    log(
      `Resumed ${session.resumeComments.length} comments and ` +
        `${session.resumeViewedFiles.length} viewed files from ${resumePath}`
    );
    for (const diagnostic of session.resumeImportDiagnostics) {
      log(`Resume import: ${diagnostic}`);
    }
  }

  // Phase 5b (main.ts): guide sidecar. It must be on the session before listening; GET /api/diff answers from there.
  const guideData = await loadGuide(
    output.path,
    config,
    diffData.files.map(f => f.newPath || f.oldPath)
  );
  if (guideData) {
    log(`Walkthrough guide loaded: ${guideData.groups.length} groups`);
  }

  // Phase 6 (main.ts) — assemble. Everything the routes read is on the
  // session before the caller opens the listener.
  // commitDiffData captures the reviewed paths that authorize every apply, and the source identity.
  commitDiffData(session, diffData, identity);
  session.guideData = guideData;
  session.config = config;
  session.outputPathInfo = { resolvedOutputPath: output.path, outputPathWritable: true };

  return { session, output };
}
