import { dialog, type BrowserWindow } from 'electron';
import { resolve } from 'path';
import { IPC } from '../shared/ipc-channels';
import type { OutputPathInfo, RemoteOpenUrlResult } from '../shared/types';
import { publishReview } from '../../packages/core/src/review-publisher';
import { takeReviewState, commitDiffData } from '../../packages/core/src/review-handlers';
import { bootstrapRemoteDiff, applyRemoteProvenance } from '../../packages/core/src/remote-mode';
import { parseForgeUrl, isCommandCancelled } from '../../packages/core/src/forge-provider';
import { loadGuide } from '../../packages/core/src/guide-loader';
import { saveAndQuit, type QuitController, type SaveFailure } from './quit-controller';
import { publicationOptions, updateOutputInfo, type DesktopSession } from './desktop-session';
import { createIpcBoundary, noArgument, stringArgument } from './ipc-boundary';
import { confirmPayload } from './presentation';
import { sendDiffLoad, sendGuideLoad, sendResumeLoad } from './ipc-handlers';

const REMOTE_OPEN_TIMEOUT_MS = 10 * 60_000;

export function registerLifecycleHandlers(
  desktop: DesktopSession,
  boundary: ReturnType<typeof createIpcBoundary>,
  controller: QuitController,
  shutdown: (code: number, reason: string) => Promise<void>
): void {
  boundary.on(IPC.APP_SAVE_AND_QUIT, noArgument, async event => {
    const window = boundary.assertPeer(event);
    await saveAndQuit({
      controller,
      takeState: () => takeReviewState(desktop.review),
      publish: async state => {
        const finalState = desktop.remoteInfo
          ? applyRemoteProvenance(state, desktop.remoteInfo)
          : state;
        await publishReview(finalState, desktop.output.path, publicationOptions(desktop));
        console.error(`[main] Review written to ${desktop.output.path}`);
      },
      reportFailure: failure => reportSaveFailure(window, failure),
      quit: () => {
        void shutdown(0, 'saved');
      },
    });
  });
  boundary.on(IPC.APP_DISCARD_AND_QUIT, noArgument, () => {
    // A discard cannot interrupt a publication that may already have committed.
    if (controller.phase === 'saving') return;
    controller.discard();
    void shutdown(0, 'discard');
  });

  boundary.handle(
    IPC.REMOTE_OPEN_URL,
    stringArgument,
    async (event, url): Promise<RemoteOpenUrlResult> => {
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
              { signal: controller.signal }
            ),
          abort
        );
        acquired = true;
        current();
        opening.assertCurrent();
        const config = desktop.review.config;
        if (config && !(await confirmPayload(payload, config, boundary.assertPeer(event))))
          return { ok: false, error: 'Review cancelled.' };
        const guide = config
          ? await loadGuide(
              desktop.output.path,
              config,
              payload.files.map(file => file.newPath || file.oldPath)
            )
          : null;
        current();
        opening.assertCurrent();
        if (desktop.remote.closed || abort.signal.aborted)
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
    }
  );

  boundary.handle(
    IPC.OUTPUT_PATH_CHANGE,
    noArgument,
    async (event): Promise<OutputPathInfo | null> => {
      const current = boundary.capture(event);
      const result = await dialog.showSaveDialog(boundary.assertPeer(event), {
        title: 'Save Review As',
        defaultPath: desktop.output.path,
        filters: [{ name: 'XML Files', extensions: ['xml'] }],
      });
      if (result.canceled || !result.filePath) return null;
      current();
      if (controller.phase !== 'reviewing') return null;
      desktop.output = { path: resolve(result.filePath), origin: 'explicit' };
      const info = updateOutputInfo(desktop);
      boundary.assertPeer(event).webContents.send(IPC.OUTPUT_PATH_CHANGED, info);
      return info;
    }
  );
}

async function reportSaveFailure(window: BrowserWindow, failure: SaveFailure): Promise<void> {
  console.error(`[main] Error saving review (${failure.code}): ${failure.message}`);
  if (window.isDestroyed()) return;
  await dialog.showMessageBox(window, {
    type: 'error',
    title: 'Review not saved',
    message: failure.message,
    detail: failure.detail,
    buttons: ['OK'],
    defaultId: 0,
  });
}
