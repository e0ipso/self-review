import { createDesktopLocalization, type DesktopLocalization } from '../shared/localization';
import { randomUUID } from 'crypto';
import { resolve } from 'path';
import { IPC } from '../shared/ipc-channels';
import type { OutputPathInfo, ReviewState, ReviewSaveResult } from '../shared/types';
import { takeReviewState, submitReviewState } from '../../packages/core/src/review-handlers';
import { saveAndQuit, describeSaveFailure, type QuitController } from './quit-controller';
import { updateOutputInfo, type DesktopSession } from './desktop-session';
import { createIpcBoundary, noArgument, reviewState, stringArgument } from './ipc-boundary';
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

export type LifecycleSession = Pick<DesktopSession, 'output' | 'operations'> & {
  review: Pick<
    DesktopSession['review'],
    'reviewState' | 'diffData' | 'attachmentOrigins' | 'outputPathInfo'
  >;
};

export function registerLifecycleHandlers(
  desktop: LifecycleSession,
  boundary: ReturnType<typeof createIpcBoundary>,
  controller: QuitController,
  shutdown: (code: number, reason: string) => Promise<void>,
  publication: ReviewPublication,
  presentation: LifecyclePresentation,
  messages: DesktopLocalization = createDesktopLocalization()
): void {
  let receipt: { token: string; current: () => void } | null = null;
  let failed: { result: ReviewSaveResult; current: () => void } | null = null;
  boundary.handle(IPC.REVIEW_SAVE_STATUS, noArgument, () => {
    if (!receipt) {
      if (!failed) return null;
      failed.current();
      return failed.result;
    }
    receipt.current();
    return { status: 'saved', receipt: receipt.token } satisfies ReviewSaveResult;
  });
  boundary.handle(IPC.REVIEW_SAVE, reviewState, (event, state): Promise<ReviewSaveResult> => {
    if (controller.phase !== 'reviewing' || desktop.operations.finishing)
      return Promise.resolve({ status: 'busy' });
    const current = boundary.capture(event);
    const source = desktop.review.diffData;
    failed = null;
    return desktop.operations.complete(
      async signal => {
        current();
        if (!controller.beginSave()) return { status: 'busy' };
        try {
          // A state from another peer/snapshot must never replace the current review.
          if (
            !source ||
            source.source.type === 'welcome' ||
            source.source.type === 'loading' ||
            desktop.review.diffData !== source ||
            JSON.stringify(state.source) !== JSON.stringify(source.source)
          )
            throw new Error('The review state does not belong to the current review.');
          signal.throwIfAborted();
          submitReviewState(desktop.review, state);
          const captured = takeReviewState(desktop.review);
          if (!captured) throw new Error('The review window did not hand over its review state.');
          await publication.publish(captured, signal);
        } catch (error) {
          controller.saveFailed();
          const failure = describeSaveFailure(error, desktop.output.path, messages);
          const result: ReviewSaveResult = {
            status: 'failed',
            message: failure.message,
            detail: failure.detail,
          };
          failed = { result, current };
          return result;
        }
        // Publication has committed. A stale peer cannot turn success into a retryable failure.
        current();
        receipt = { token: randomUUID(), current };
        return { status: 'saved', receipt: receipt.token };
      },
      false,
      () => controller.phase === 'saving'
    );
  });
  boundary.on(IPC.REVIEW_SAVE_RECEIVED, stringArgument, (_event, token) => {
    if (!receipt || token !== receipt.token) throw new Error('Unknown publication receipt.');
    receipt.current();
    receipt = null;
    controller.saveSucceeded();
    desktop.operations.releaseCompletion();
    // Do not await shutdown from an operation that shutdown itself drains.
    void shutdown(0, 'saved');
  });

  boundary.on(IPC.APP_SAVE_AND_QUIT, noArgument, event => {
    const window = boundary.assertPeer(event);
    const current = boundary.capture(event);
    if (controller.phase !== 'reviewing') return;
    return desktop.operations.complete(async signal => {
      current();
      const result = await saveAndQuit({
        controller,
        messages,
        takeState: () => takeReviewState(desktop.review),
        publish: state => publication.publish(state, signal),
        reportFailure: failure => presentation.reportSaveFailure(window, failure),
        quit: () => {
          void shutdown(0, 'saved');
        },
      });
      if (result === 'failed') {
        current();
        window.webContents.send(IPC.REVIEW_SAVE_FAILED);
      }
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
