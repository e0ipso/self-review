import { IPC } from '../shared/ipc-channels';
import type { createIpcBoundary } from './ipc-boundary';
import { noArgument, reviewState } from './ipc-boundary';
import type { DesktopReviewOperations } from './review-operations';
import type { DesktopOperations } from './desktop-operations';
import type { ImageLoadResult, ReviewState, ExpandContextRequest } from '../shared/types';
import {
  attachmentValue,
  contentPath,
  contentExpansionRequest,
  registerReadHandlers,
} from './content-reads';
import { checkContentBudget } from './content-budget';
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
  const deliver = contentDelivery(boundary, operations, review.captureReadSnapshot);
  // Handle diff data request from renderer
  boundary.on(IPC.DIFF_REQUEST, noArgument, event => {
    deliver('diff', event, () => {
      const load = review.getDiffLoad();
      if (load) {
        checkContentBudget(load);
        event.sender.send(IPC.DIFF_LOAD, load.diff);
        // The guide rides after the diff payload, and only when there is one.
        if (load.guide) {
          event.sender.send(IPC.GUIDE_LOAD, load.guide);
        }
      }
    });
  });

  // Handle image loading for rendered preview
  boundary.handle(
    IPC.DIFF_LOAD_IMAGE,
    contentPath,
    async (_event, filePath: string): Promise<ImageLoadResult> =>
      operations.read(async signal => {
        const result = await review.loadImage(filePath, signal);
        checkContentBudget(result);
        return result;
      })
  );

  // Handle single-file content loading for lazy (large-payload) mode
  boundary.handle(IPC.DIFF_LOAD_FILE, contentPath, async (_event, filePath: string) =>
    operations.read(async () => {
      const result = review.getFileHunks(filePath);
      checkContentBudget({ hunks: result });
      return result;
    })
  );

  // Handle config request from renderer
  boundary.on(IPC.CONFIG_REQUEST, noArgument, event => {
    deliver('config', event, () => {
      const load = review.getConfigLoad();
      if (load) {
        checkContentBudget(load);
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
  boundary.on(IPC.REVIEW_SUBMIT, decodeSubmission, (_event, state: ReviewState) => {
    if (operations.finishing) throw new Error('The review is finishing.');
    review.submitReviewState(state);
  });

  // Core owns authorization and filesystem policy. Only a missing asset becomes null.
  boundary.handle(
    IPC.ATTACHMENT_READ,
    contentPath,
    async (_event, reference: unknown): Promise<ArrayBuffer | null> => {
      const result = await operations.read(signal => review.readAttachment(reference, signal));
      const value = attachmentValue(result);
      checkContentBudget(value);
      return value;
    }
  );

  // Send resumed comments and viewed files when the renderer is ready
  // (after diff data is loaded)
  boundary.on(IPC.RESUME_REQUEST, noArgument, event => {
    deliver('resume', event, () => {
      const payload = review.getResumeLoad();
      checkContentBudget(payload);
      event.sender.send(IPC.RESUME_LOAD, payload ?? { comments: [], viewedFiles: [] });
    });
  });

  // Expand context for a single file by re-running git diff with more context lines
  boundary.handle(
    IPC.DIFF_EXPAND_CONTEXT,
    contentExpansionRequest,
    async (_event, request: ExpandContextRequest) =>
      operations.apply(async signal => {
        const result = await review.expandContext(request, signal);
        checkContentBudget(result);
        return result;
      })
  );

  boundary.handle(IPC.REVIEW_HANDOFF, decodeSubmission, (_event, state) => {
    if (operations.finishing) throw new Error('The review is finishing.');
    review.submitReviewState(state);
  });
}
