// Resolve one review session the way the desktop does. Each phase below cites
// the phase of `initializeApp` (src/main/main.ts) it mirrors, and the
// decisions both have to make the same way — output target and its trust,
// diff arguments and configuration provenance, what the arguments review,
// resuming a prior document — are core's (`@self-review/core`'s startup
// module), called from both.
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
  /**
   * The resolved session, complete: diff, guide, config, resume state and
   * the source identity every path-taking route authorizes against. There
   * is no separate containment root: the routes ask core, which checks the
   * very root it reads from (audit A6).
   */
  session: ReviewSession;
  /**
   * Where the review is published, fixed for the lifetime of the process:
   * the absolute path, and whether the reviewer named it (`--output`, or
   * their own user-level `output-file`: `explicit`) or the project
   * configuration or default did (`inherited`, contained under the launch
   * directory by the publisher).
   */
  output: ReviewOutputTarget;
}

const log = (message: string) => console.error(`[serve] ${message}`);

/**
 * Resolve the session to serve. Throws when there is nothing to review, the
 * output path cannot be written, a committed configuration supplies git
 * options the review refuses, or the resume file cannot be read; the caller
 * reports and exits.
 */
export async function resolveSession(args: ServeArgs): Promise<ServeStartup> {
  // Phase 2 (main.ts) — configuration and the output path. Fixed here and
  // never again: no route changes it. Which of the three named it decides
  // how far the publisher trusts it; see resolveOutputTarget.
  const cwd = process.cwd();
  const loadedConfig = loadConfigWithProvenance({ cwd });
  const output = resolveOutputTarget(args.outputPath, loadedConfig, cwd);
  // The publisher's own read-only checks, so this hint and the save-time
  // error agree: the leaf policy, the inherited-path containment and the
  // directory's writability. Advisory — the publisher re-checks at submit
  // and the browser keeps the review for a retry — but refusing an output
  // that could never be written beats serving a review with no way out.
  const problem = inspectOutputPath(output.path, publishOptionsFor(output));
  if (problem) {
    throw new Error(
      `Output path is not writable (${problem.code}): ${problem.message} ` +
        'Pass a writable path with --output, or set output-file in .self-review.yaml.'
    );
  }
  log(`Output path: ${output.path} (${output.origin})`);

  // Phase 3 (main.ts) — git diff arguments: the command line's, or the
  // configured default-diff-args, which a committed configuration may not
  // use to make git write or run programs; then the staged/untracked default.
  const { gitDiffArgs, config } = resolveStartupDiffArgs(args.gitDiffArgs, loadedConfig, cwd);

  // Phase 4 (main.ts) — what to review. Welcome mode diverges: there is no
  // directory picker in a browser, so refusing beats serving an interface
  // whose controls are dead.
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

  // Phase 4b (main.ts) — large payload. The desktop asks; there is nobody
  // to ask before the browser connects, so the threshold simply turns on
  // lazy per-file loading (GET /api/file) and says so.
  const stats = computePayloadStats(diffData.files.length, countTotalLines(diffData.files), config);
  if (stats.exceedsAny) {
    log(
      `Large payload: ${stats.fileCount} files, ${stats.totalLines} lines ` +
        `(thresholds ${config.maxFiles} files, ${config.maxTotalLines} lines) — ` +
        'serving file contents on demand'
    );
    diffData.isLargePayload = true;
  }

  // Phase 5 (main.ts) — resume a prior review, attachments resolving beside
  // the resumed document rather than the cwd or the output.
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

  // Phase 5b (main.ts) — the walkthrough guide sidecar, discovered next to
  // the output path. Tolerant by contract: loadGuide never throws.
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
  // Committed through core so the session's reviewed paths, which authorize
  // every apply, are captured from this diff, and its source identity, which
  // every path-taking route authorizes against, is recorded with it.
  commitDiffData(session, diffData, identity);
  session.guideData = guideData;
  session.config = config;
  // Writable as far as startup could tell: it refused above if it was not.
  session.outputPathInfo = { resolvedOutputPath: output.path, outputPathWritable: true };

  return { session, output };
}
