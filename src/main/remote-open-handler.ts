import { IPC } from '../shared/ipc-channels';
import type { RemoteOpenUrlResult } from '../shared/types';
import { commitDiffData } from '../../packages/core/src/review-handlers';
import { bootstrapRemoteDiff } from '../../packages/core/src/remote-mode';
import { parseForgeUrl, isCommandCancelled } from '../../packages/core/src/forge-provider';
import { loadGuide } from '../../packages/core/src/guide-loader';
import type { DesktopSession } from './desktop-session';
import { createIpcBoundary, stringArgument } from './ipc-boundary';
import type { ReviewPresentation } from './presentation';
import { sendDiffLoad, sendGuideLoad, sendResumeLoad } from './ipc-handlers';

const REMOTE_OPEN_TIMEOUT_MS = 10 * 60_000;

/** Owns the one welcome-to-remote transition, including cleanup before any failed handoff. */
export function registerRemoteOpenHandler(
  desktop: DesktopSession,
  boundary: ReturnType<typeof createIpcBoundary>,
  presentation: Pick<ReviewPresentation, 'confirmPayload'>
): void {
  boundary.handleCommand(
    IPC.REMOTE_OPEN_URL,
    stringArgument,
    async (event, url): Promise<RemoteOpenUrlResult> =>
      desktop.operations.read(async signal => {
        const current = boundary.capture(event);
        let opening: ReturnType<typeof desktop.transition.begin> | undefined;
        let deadline: NodeJS.Timeout | undefined;
        const abort = new AbortController();
        const window = boundary.assertPeer(event);
        const cancel = () => abort.abort(new Error('the review window closed'));
        window.once('closed', cancel);
        let acquired = false;
        let committed = false;
        try {
          if (!parseForgeUrl(url)) throw new Error('Enter a GitHub PR or GitLab MR URL.');
          opening = desktop.transition.begin();
          deadline = setTimeout(
            () => abort.abort(new Error('opening the PR/MR took longer than 10 minutes')),
            REMOTE_OPEN_TIMEOUT_MS
          );
          const { session, payload, identity } = await desktop.remote.open(
            controller =>
              bootstrapRemoteDiff(
                url,
                desktop.cwd,
                desktop.review.config?.ignore ?? [],
                {},
                { signal: AbortSignal.any([signal, controller.signal]) }
              ),
            abort
          );
          acquired = true;
          current();
          opening.assertCurrent();
          const config = desktop.review.config;
          if (
            config &&
            !(await presentation.confirmPayload(payload, config, boundary.assertPeer(event)))
          )
            return { ok: false, error: 'Review cancelled.' };
          const guide = config
            ? await loadGuide(
                desktop.output.path,
                config,
                payload.files.map(file => file.newPath || file.oldPath),
                {
                  cwd: desktop.cwd,
                  reportDiagnostic: message => console.error(message),
                  signal: AbortSignal.any([signal, abort.signal]),
                }
              )
            : null;
          current();
          opening.assertCurrent();
          if (desktop.remote.closed || abort.signal.aborted || signal.aborted)
            throw new Error('Opening the PR/MR was cancelled.');
          desktop.remoteInfo = session.remote;
          commitDiffData(desktop.review, payload, identity);
          desktop.review.guideData = guide;
          desktop.review.resumeComments = session.fetchedComments;
          desktop.review.resumeViewedFiles = [];
          committed = true;
          const window = boundary.assertPeer(event);
          sendDiffLoad(window, payload);
          if (guide) sendGuideLoad(window, guide);
          if (session.fetchedComments.length)
            sendResumeLoad(window, { comments: session.fetchedComments, viewedFiles: [] });
          return { ok: true };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error('[main] Failed to open remote URL:', message);
          return {
            ok: false,
            error: isCommandCancelled(error)
              ? `Opening the PR/MR was cancelled: ${abort.signal.reason instanceof Error ? abort.signal.reason.message : message}`
              : message,
          };
        } finally {
          window.removeListener('closed', cancel);
          clearTimeout(deadline);
          if (acquired && !committed) await desktop.remote.cancelOpen();
          opening?.finish();
        }
      }, REMOTE_OPEN_TIMEOUT_MS)
  );
}
