// Load the desktop session before exposing any renderer or IPC handlers.
import { resolve } from 'path';
import { commitDiffData, commitLoadedReview } from '../../packages/core/src/review-handlers';
import { computeRemoteDrift, mergeRemoteThreads } from '../../packages/core/src/remote-mode';
import { confirmPayload } from './presentation';
import { type DesktopSession } from './desktop-session';
import type { ReviewComment } from '../shared/types';
import { defaultStartupOperations, type StartupOperations } from './startup-operations';

/** False means the reviewer declined a large payload. Errors are handled by main's shutdown. */
export async function initializeSession(
  desktop: DesktopSession,
  signal = desktop.operations.signal,
  confirm = confirmPayload,
  operations: StartupOperations = defaultStartupOperations
): Promise<boolean> {
  signal.throwIfAborted();
  const { review, cwd, remote } = desktop;
  const plan = await operations.prepare(cwd, signal);
  signal.throwIfAborted();
  if (remote.closed) return false;
  const { config, source } = plan;
  desktop.output = plan.output;
  const problem = await operations.inspectOutput?.(plan.output, review.attachmentOrigins);
  signal.throwIfAborted();
  if (remote.closed) return false;
  review.outputPathInfo = {
    resolvedOutputPath: plan.output.path,
    outputPathWritable: !problem,
  };
  if (problem) {
    try {
      void Promise.resolve(
        operations.reportDiagnostic(
          `[main] Output path check (${problem.code}): ${problem.message}`
        )
      ).catch(() => {});
    } catch {
      // An advisory diagnostic cannot change the inspected state.
    }
  }
  review.config = config;
  let fetchedComments: ReviewComment[] = [];
  let loaded: Awaited<ReturnType<StartupOperations['loadLocal']>>;
  if (source.mode === 'remote') {
    const result = await remote.open(controller =>
      operations.loadRemote(
        plan.remoteUrl!,
        cwd,
        config.ignore,
        AbortSignal.any([signal, controller.signal])
      )
    );
    desktop.remoteInfo = result.session.remote;
    fetchedComments = result.session.fetchedComments;
    loaded = result;
  } else {
    loaded = await operations.loadLocal(plan, cwd, signal);
  }
  signal.throwIfAborted();
  if (remote.closed) return false;
  const { payload, identity } = loaded;
  if (payload.source.type !== 'welcome' && !(await confirm(payload, config))) return false;
  signal.throwIfAborted();
  if (remote.closed) return false;
  if ('loadedReview' in loaded && loaded.loadedReview)
    commitLoadedReview(review, payload, loaded.loadedReview);
  else commitDiffData(review, payload, identity);
  let recordedHead: string | undefined;
  if (plan.resumeFrom) {
    const parsed = await operations.resume(review, resolve(cwd, plan.resumeFrom), signal);
    signal.throwIfAborted();
    if (remote.closed) return false;
    review.resumeComments = parsed.comments;
    review.resumeViewedFiles = parsed.viewedFiles;
    recordedHead = parsed.remoteHeadSha;
    for (const diagnostic of review.resumeImportDiagnostics)
      operations.reportDiagnostic(`[main] Resume import: ${diagnostic}`);
  }
  if (desktop.remoteInfo) {
    review.resumeComments = mergeRemoteThreads(review.resumeComments, fetchedComments);
    review.resumeRemoteDrift = computeRemoteDrift(recordedHead, desktop.remoteInfo.remoteHeadSha);
  }
  if (payload.source.type !== 'welcome') {
    review.guideData = await operations.guide(
      desktop.output.path,
      config,
      payload.files.map(file => file.newPath || file.oldPath),
      { cwd, reportDiagnostic: operations.reportDiagnostic, signal }
    );
  }
  signal.throwIfAborted();
  return !remote.closed;
}
