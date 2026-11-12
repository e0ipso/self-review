import { IPC } from '../shared/ipc-channels';
import type { createIpcBoundary } from './ipc-boundary';
import { noArgument, reviewState } from './ipc-boundary';
import type { DesktopReviewOperations } from './review-operations';
import type { DesktopOperations } from './desktop-operations';
import type { ReviewState } from '../shared/types';
import { registerReadHandlers } from './content-reads';
import { registerLegacyContentHandlers } from './legacy-content-ipc';
import { prepareContent, prepareDiffDelivery, prepareResumeLoad } from './ipc-delivery';
import { contentDelivery } from './content-delivery';
export function registerContentHandlers(
  review: Pick<
    DesktopReviewOperations,
    | 'getDiffLoad'
    | 'loadImage'
    | 'getFileHunks'
    | 'getConfigLoad'
    | 'submitReviewState'
    | 'invalidateReviewState'
    | 'readAttachment'
    | 'getResumeLoad'
    | 'expandContext'
  > &
    Partial<Pick<DesktopReviewOperations, 'captureReadSnapshot'>>,
  boundary: ReturnType<typeof createIpcBoundary>,
  operations: DesktopOperations
) {
  registerReadHandlers(review, boundary, operations);
  registerLegacyContentHandlers(review, boundary, operations);
  const deliver = contentDelivery(boundary, operations, review.captureReadSnapshot);
  // Handle diff data request from renderer
  boundary.onCommand(IPC.DIFF_REQUEST, noArgument, event => {
    deliver('diff', event, () => {
      const load = review.getDiffLoad();
      if (load) {
        const wire = prepareDiffDelivery(load.diff, load.guide);
        event.sender.send(IPC.DIFF_LOAD, wire.diff);
        // The guide rides after the diff payload, and only when there is one.
        if (wire.guide) {
          event.sender.send(IPC.GUIDE_LOAD, wire.guide);
        }
      }
    });
  });

  // Handle config request from renderer
  boundary.onCommand(IPC.CONFIG_REQUEST, noArgument, event => {
    deliver('config', event, () => {
      const load = review.getConfigLoad();
      if (load) {
        prepareContent(load);
        event.sender.send(IPC.CONFIG_LOAD, load.config, load.outputPathInfo);
      }
    });
  });

  const decodeSubmission = (value: unknown) => {
    if (operations.finishing) throw new Error('The review is finishing.');
    try {
      return reviewState(value);
    } catch (error) {
      // A legacy submit/save pair must not publish an older cached snapshot after refusal.
      review.invalidateReviewState();
      throw error;
    }
  };

  // Handle review submission from renderer
  boundary.onCommand(IPC.REVIEW_SUBMIT, decodeSubmission, (_event, state: ReviewState) => {
    if (operations.finishing) throw new Error('The review is finishing.');
    review.submitReviewState(state);
  });

  // Send resumed comments and viewed files when the renderer is ready
  // (after diff data is loaded)
  boundary.onCommand(IPC.RESUME_REQUEST, noArgument, event => {
    deliver('resume', event, () => {
      const payload = prepareResumeLoad(review.getResumeLoad());
      event.sender.send(IPC.RESUME_LOAD, payload);
    });
  });

  boundary.handleCommand(IPC.REVIEW_HANDOFF, decodeSubmission, (_event, state) => {
    if (operations.finishing) throw new Error('The review is finishing.');
    review.submitReviewState(state);
  });
}
