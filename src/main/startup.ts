// Load the desktop session before exposing any renderer or IPC handlers.
import { resolve } from 'path';
import { parseCliArgs } from './cli';
import { loadConfigWithProvenance } from '../../packages/core/src/config';
import { resolveStartupSourceAsync } from '../../packages/core/src/startup-mode';
import {
  loadLocalReview,
  loadResumeDocument,
  resolveOutputTarget,
  resolveStartupDiffArgs,
} from '../../packages/core/src/startup';
import { commitDiffData } from '../../packages/core/src/review-handlers';
import {
  bootstrapRemoteDiff,
  computeRemoteDrift,
  mergeRemoteThreads,
} from '../../packages/core/src/remote-mode';
import { loadGuide } from '../../packages/core/src/guide-loader';
import { confirmPayload } from './presentation';
import { updateOutputInfo, type DesktopSession } from './desktop-session';
import type { ReviewComment } from '../shared/types';

/** False means the reviewer declined a large payload. Errors are handled by main's shutdown. */
export async function initializeSession(
  desktop: DesktopSession,
  signal = desktop.operations.signal,
  confirm = confirmPayload
): Promise<boolean> {
  signal.throwIfAborted();
  const { review, cwd, remote } = desktop;
  const cli = parseCliArgs();
  const loadedConfig = loadConfigWithProvenance({ cwd });
  desktop.output = resolveOutputTarget(null, loadedConfig, cwd);
  updateOutputInfo(desktop);
  const { config, gitDiffArgs } = resolveStartupDiffArgs(cli.gitDiffArgs, loadedConfig, cwd);
  review.config = config;
  const source = cli.remoteUrl
    ? { mode: 'remote' as const }
    : await resolveStartupSourceAsync(gitDiffArgs, cwd, { signal, timeoutMs: 30_000 });
  let fetchedComments: ReviewComment[] = [];
  let loaded: Awaited<ReturnType<typeof loadLocalReview>>;
  if (source.mode === 'remote') {
    const result = await remote.open(controller =>
      bootstrapRemoteDiff(
        cli.remoteUrl!,
        cwd,
        config.ignore,
        {},
        { signal: AbortSignal.any([signal, controller.signal]) }
      )
    );
    desktop.remoteInfo = result.session.remote;
    fetchedComments = result.session.fetchedComments;
    loaded = result;
  } else {
    loaded = await loadLocalReview(
      source,
      gitDiffArgs,
      config,
      cwd,
      message => console.error(`[main] ${message}`),
      { signal, timeoutMs: 30_000 }
    );
  }
  signal.throwIfAborted();
  if (remote.closed) return false;
  const { payload, identity } = loaded;
  if (payload.source.type !== 'welcome' && !(await confirm(payload, config))) return false;
  signal.throwIfAborted();
  if (remote.closed) return false;
  commitDiffData(review, payload, identity);
  let recordedHead: string | undefined;
  if (cli.resumeFrom) {
    const parsed = loadResumeDocument(review, resolve(cwd, cli.resumeFrom));
    review.resumeComments = parsed.comments;
    review.resumeViewedFiles = parsed.viewedFiles;
    recordedHead = parsed.remoteHeadSha;
    for (const diagnostic of review.resumeImportDiagnostics)
      console.error(`[main] Resume import: ${diagnostic}`);
  }
  if (desktop.remoteInfo) {
    review.resumeComments = mergeRemoteThreads(review.resumeComments, fetchedComments);
    review.resumeRemoteDrift = computeRemoteDrift(recordedHead, desktop.remoteInfo.remoteHeadSha);
  }
  if (payload.source.type !== 'welcome') {
    review.guideData = await loadGuide(
      desktop.output.path,
      config,
      payload.files.map(file => file.newPath || file.oldPath),
      { cwd, reportDiagnostic: message => console.error(message) }
    );
  }
  signal.throwIfAborted();
  return !remote.closed;
}
