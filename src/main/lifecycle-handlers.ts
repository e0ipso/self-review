import { resolve } from 'path';
import { IPC } from '../shared/ipc-channels';
import type { OutputPathInfo, ReviewState } from '../shared/types';
import { takeReviewState } from '../../packages/core/src/review-handlers';
import { saveAndQuit, type QuitController } from './quit-controller';
import { updateOutputInfo, type DesktopSession } from './desktop-session';
import { createIpcBoundary, noArgument } from './ipc-boundary';
import type { BrowserWindow } from 'electron';
import type { SaveFailure } from './quit-controller';

export interface LifecyclePresentation {
  pickOutputPath: (window: BrowserWindow, defaultPath: string) => Promise<string | null>;
  reportSaveFailure: (window: BrowserWindow, failure: SaveFailure) => Promise<void>;
}

/** Publication and native presentation are supplied by main, alongside session ownership. */
export interface ReviewPublication {
  publish: (state: ReviewState, signal: AbortSignal) => Promise<void>;
}

export function registerLifecycleHandlers(
  desktop: DesktopSession,
  boundary: ReturnType<typeof createIpcBoundary>,
  controller: QuitController,
  shutdown: (code: number, reason: string) => Promise<void>,
  publication: ReviewPublication,
  presentation: LifecyclePresentation
): void {
  boundary.on(IPC.APP_SAVE_AND_QUIT, noArgument, event => {
    const window = boundary.assertPeer(event);
    const current = boundary.capture(event);
    if (controller.phase !== 'reviewing') return;
    return desktop.operations.complete(async signal => {
      current();
      await saveAndQuit({
        controller,
        takeState: () => takeReviewState(desktop.review),
        publish: state => publication.publish(state, signal),
        reportFailure: failure => presentation.reportSaveFailure(window, failure),
        quit: () => {
          void shutdown(0, 'saved');
        },
      });
    });
  });
  boundary.on(IPC.APP_DISCARD_AND_QUIT, noArgument, event => {
    if (controller.phase !== 'reviewing') return;
    const current = boundary.capture(event);
    return desktop.operations.complete(async () => {
      current();
      controller.discard();
      void shutdown(0, 'discard');
    }, true);
  });

  boundary.handle(IPC.OUTPUT_PATH_CHANGE, noArgument, event =>
    desktop.operations.read(async signal => {
      const current = boundary.capture(event);
      const filePath = await presentation.pickOutputPath(
        boundary.assertPeer(event),
        desktop.output.path
      );
      if (!filePath) return null;
      current();
      signal.throwIfAborted();
      if (controller.phase !== 'reviewing') return null;
      desktop.output = { path: resolve(filePath), origin: 'explicit' };
      const info: OutputPathInfo = updateOutputInfo(desktop);
      boundary.assertPeer(event).webContents.send(IPC.OUTPUT_PATH_CHANGED, info);
      return info;
    }, 10 * 60_000)
  );
}
