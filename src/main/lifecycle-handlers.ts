import { sameDiffSource } from '../../packages/core/src/same-diff-source';
import { PublicationReceipts } from './publication-receipts';
import { registerOutputSelection } from './output-selection';
import { createDesktopLocalization, type DesktopLocalization } from '../shared/localization';
import { IPC } from '../shared/ipc-channels';
import type { ReviewState, ReviewSaveResult } from '../shared/types';
import { takeReviewState, submitReviewState } from '../../packages/core/src/review-handlers';
import { saveAndQuit, describeSaveFailure, type QuitController } from './quit-controller';
import { type DesktopSession } from './desktop-session';
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
  const receipts = new PublicationReceipts();
  const recordFailure = (error: unknown, current: () => void): ReviewSaveResult => {
    const failure = describeSaveFailure(error, desktop.output.path, messages);
    const result: ReviewSaveResult = {
      status: 'failed',
      message: failure.message,
      detail: failure.detail,
    };
    return receipts.recordFailure(result, current);
  };
  boundary.handleCommand(IPC.REVIEW_SAVE_STATUS, noArgument, () => receipts.inspect());
  boundary.handleDeferredCommand(
    IPC.REVIEW_SAVE,
    reviewState,
    (event, decode): Promise<ReviewSaveResult> => {
      if (controller.phase !== 'reviewing' || desktop.operations.finishing)
        return Promise.resolve({ status: 'busy' });
      const current = boundary.capture(event);
      let state: ReviewState;
      try {
        state = decode();
      } catch (error) {
        // This refusal precedes publication, so it has a known failed outcome.
        return Promise.resolve(recordFailure(error, current));
      }
      const source = desktop.review.diffData;
      receipts.clearFailure();
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
              !sameDiffSource(source.source, state.source)
            )
              throw new Error('The review state does not belong to the current review.');
            signal.throwIfAborted();
            submitReviewState(desktop.review, state);
            const captured = takeReviewState(desktop.review);
            if (!captured) throw new Error('The review window did not hand over its review state.');
            await publication.publish(captured, signal);
          } catch (error) {
            controller.saveFailed();
            return recordFailure(error, current);
          }
          // Publication has committed. A stale peer cannot turn success into a retryable failure.
          current();
          return receipts.saved(current);
        },
        false,
        () => controller.phase === 'saving'
      );
    }
  );
  boundary.onCommand(IPC.REVIEW_SAVE_RECEIVED, stringArgument, (_event, token) => {
    receipts.acknowledge(token);
    controller.saveSucceeded();
    desktop.operations.releaseCompletion();
    // Do not await shutdown from an operation that shutdown itself drains.
    void shutdown(0, 'saved');
  });

  boundary.onCommand(IPC.APP_SAVE_AND_QUIT, noArgument, event => {
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
  boundary.onCommand(IPC.APP_DISCARD_AND_QUIT, noArgument, event => {
    if (controller.phase !== 'reviewing') return;
    const current = boundary.capture(event);
    return desktop.operations.complete(async () => {
      current();
      controller.discard();
      void shutdown(0, 'discard');
    }, true);
  });

  registerOutputSelection(desktop, boundary, controller, presentation);
}
