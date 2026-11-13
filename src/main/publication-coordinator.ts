// Owns publication admission, receipts and recovery for both desktop save protocols.
import type { BrowserWindow } from 'electron';
import { captureDesktopPublication } from './publication';
import { saveReview } from './save-transaction';
import { PublicationReceipts } from './publication-receipts';
import { IPC } from '../shared/ipc-channels';
import type { ReviewState, ReviewSaveResult } from '../shared/types';
import { submitReviewState } from '../../packages/core/src/review-handlers';
import { saveAndQuit, describeSaveFailure, type QuitController } from './quit-controller';
import type { ReviewPublication, LifecyclePresentation } from './lifecycle-handlers';
import type { DesktopLocalization } from '../shared/localization';
import type { DesktopSession } from './desktop-session';

interface PublicationSession {
  output: DesktopSession['output'];
  operations: Pick<DesktopSession['operations'], 'complete' | 'releaseCompletion' | 'finishing'>;
  review: Pick<DesktopSession['review'], 'reviewState' | 'diffData'>;
}

export function createPublicationCoordinator(
  desktop: PublicationSession,
  controller: QuitController,
  shutdown: (code: number, reason: string) => Promise<void>,
  publication: ReviewPublication,
  presentation: Pick<LifecyclePresentation, 'reportSaveFailure'>,
  messages: DesktopLocalization
) {
  const receipts = new PublicationReceipts();
  // A discard event expresses intent, never acknowledgement. Retain it only for
  // this publication's peer and load, and join admitted work before closing.
  let activeSave: {
    current: () => void;
    pending: boolean;
    committed: boolean;
    close: boolean;
    receiptProtocol: boolean;
  } | null = null;
  const closeRecovered = (owner: NonNullable<typeof activeSave>) => {
    if (activeSave !== owner || owner.pending || !owner.close || controller.mayQuit) return;
    try {
      owner.current();
    } catch {
      return;
    }
    if (owner.committed) controller.saveSucceeded();
    else controller.discard();
    desktop.operations.releaseCompletion();
    void shutdown(0, owner.committed ? 'saved' : 'discard');
  };
  const ownSave = (current: () => void, receiptProtocol = false) => {
    const review = desktop.review;
    const payload = review.diffData;
    const output = desktop.output;
    const outputPath = output.path;
    const owner = {
      pending: true,
      receiptProtocol,
      committed: false,
      close: false,
      current: () => {
        current();
        if (
          desktop.review !== review ||
          review.diffData !== payload ||
          desktop.output !== output ||
          output.path !== outputPath
        )
          throw new Error('The publication owner has changed.');
      },
    };
    activeSave = owner;
    return owner;
  };
  const trackSave = <T>(owner: NonNullable<typeof activeSave>, work: Promise<T>): Promise<T> => {
    const settled = () => {
      owner.pending = false;
      closeRecovered(owner);
    };
    void work.then(settled, settled);
    return work;
  };
  const recordFailure = (error: unknown, current: () => void): ReviewSaveResult => {
    const failure = describeSaveFailure(error, desktop.output.path, messages);
    const result: ReviewSaveResult = {
      status: 'failed',
      message: failure.message,
      detail: failure.detail,
    };
    return receipts.recordFailure(result, current);
  };
  const save = (
    capture: () => () => void,
    decode: () => ReviewState
  ): Promise<ReviewSaveResult> => {
    if (controller.phase !== 'reviewing' || desktop.operations.finishing)
      return Promise.resolve({ status: 'busy' });
    const current = capture();
    let state: ReviewState;
    try {
      state = decode();
    } catch (error) {
      // This refusal precedes publication, so it has a known failed outcome.
      return Promise.resolve(recordFailure(error, current));
    }
    const prepare = captureDesktopPublication(desktop.review, desktop.output.path);
    receipts.clearFailure();
    const owner = ownSave(current, true);
    const work = desktop.operations.complete(
      async signal => {
        current();
        const result = await saveReview({
          controller,
          messages,
          outputPath: desktop.output.path,
          takeState: () => {
            signal.throwIfAborted();
            const owned = prepare(state);
            submitReviewState(desktop.review, owned);
            return owned;
          },
          publish: captured => publication.publish(captured, signal),
        });
        if (result.status === 'busy') return result;
        if (result.status === 'failed') {
          return receipts.recordFailure(
            { status: 'failed', message: result.failure.message, detail: result.failure.detail },
            current
          );
        }
        // Record commit before delivery. Stale peers still cannot receive or consume it.
        owner.committed = true;
        const receipt = receipts.saved(owner.current);
        current();
        return receipt;
      },
      false,
      () => controller.phase === 'saving'
    );
    return trackSave(owner, work);
  };
  const received = (token: string) => {
    receipts.acknowledge(token);
    controller.saveSucceeded();
    desktop.operations.releaseCompletion();
    // Do not await shutdown from an operation that shutdown itself drains.
    void shutdown(0, 'saved');
  };

  const legacySave = (window: BrowserWindow, current: () => void) => {
    if (controller.phase !== 'reviewing' || desktop.operations.finishing) return;
    const prepare = captureDesktopPublication(desktop.review, desktop.output.path);
    const state = desktop.review.reviewState;
    const owner = ownSave(current);
    return trackSave(
      owner,
      desktop.operations.complete(async signal => {
        current();
        const result = await saveAndQuit({
          controller,
          messages,
          takeState: () => (state ? prepare(state) : null),
          publish: async state => {
            await publication.publish(state, signal);
            owner.committed = true;
          },
          reportFailure: failure => presentation.reportSaveFailure(window, failure),
          quit: () => {
            void shutdown(0, 'saved');
          },
        });
        if (result === 'failed') {
          current();
          window.webContents.send(IPC.REVIEW_SAVE_FAILED);
        }
      })
    );
  };
  const discard = (capture: () => () => void) => {
    if (
      activeSave &&
      (controller.phase === 'saving' || activeSave.receiptProtocol) &&
      (activeSave.pending || activeSave.committed)
    ) {
      activeSave.current();
      activeSave.close = true;
      closeRecovered(activeSave);
      return;
    }
    if (controller.phase !== 'reviewing') return;
    const current = capture();
    return desktop.operations.complete(async () => {
      current();
      controller.discard();
      void shutdown(0, 'discard');
    }, true);
  };
  return { save, received, legacySave, discard, inspect: () => receipts.inspect() };
}
