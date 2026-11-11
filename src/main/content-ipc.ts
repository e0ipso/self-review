import { IPC } from '../shared/ipc-channels';
import type { createIpcBoundary } from './ipc-boundary';
import { noArgument, stringArgument, reviewState, expansionRequest } from './ipc-boundary';
import type { DesktopReviewOperations } from './review-operations';
import type { DesktopOperations } from './desktop-operations';
import type { ImageLoadResult, ReviewState, ExpandContextRequest } from '../shared/types';
export function registerContentHandlers(
  review: Pick<
    DesktopReviewOperations,
    | 'getDiffLoad'
    | 'loadImage'
    | 'getFileHunks'
    | 'getConfigLoad'
    | 'submitReviewState'
    | 'readAttachment'
    | 'getResumeLoad'
    | 'expandContext'
  >,
  boundary: ReturnType<typeof createIpcBoundary>,
  operations: DesktopOperations
) {
  // Handle diff data request from renderer
  boundary.on(IPC.DIFF_REQUEST, noArgument, event => {
    const load = review.getDiffLoad();
    if (load) {
      event.sender.send(IPC.DIFF_LOAD, load.diff);
      // The guide rides after the diff payload, and only when there is one.
      if (load.guide) {
        event.sender.send(IPC.GUIDE_LOAD, load.guide);
      }
    }
  });

  // Handle image loading for rendered preview
  boundary.handle(
    IPC.DIFF_LOAD_IMAGE,
    stringArgument,
    async (_event, filePath: string): Promise<ImageLoadResult> =>
      operations.read(signal => review.loadImage(filePath, signal))
  );

  // Handle single-file content loading for lazy (large-payload) mode
  boundary.handle(IPC.DIFF_LOAD_FILE, stringArgument, async (_event, filePath: string) =>
    operations.read(async () => review.getFileHunks(filePath))
  );

  // Handle config request from renderer
  boundary.on(IPC.CONFIG_REQUEST, noArgument, event => {
    const load = review.getConfigLoad();
    if (load) {
      event.sender.send(IPC.CONFIG_LOAD, load.config, load.outputPathInfo);
    }
  });

  // Handle review submission from renderer
  boundary.on(IPC.REVIEW_SUBMIT, reviewState, (_event, state: ReviewState) => {
    if (operations.finishing) throw new Error('The review is finishing.');
    review.submitReviewState(state);
  });

  // Core authorizes the reference; anything it refuses reads as missing.
  boundary.handle(
    IPC.ATTACHMENT_READ,
    stringArgument,
    async (_event, reference: unknown): Promise<ArrayBuffer | null> => {
      const result = await operations.read(signal => review.readAttachment(reference, signal));
      return result.ok ? result.data : null;
    }
  );

  // Send resumed comments and viewed files when the renderer is ready
  // (after diff data is loaded)
  boundary.on(IPC.RESUME_REQUEST, noArgument, event => {
    const payload = review.getResumeLoad();
    event.sender.send(IPC.RESUME_LOAD, payload ?? { comments: [], viewedFiles: [] });
  });

  // Expand context for a single file by re-running git diff with more context lines
  boundary.handle(
    IPC.DIFF_EXPAND_CONTEXT,
    expansionRequest,
    async (_event, request: ExpandContextRequest) =>
      operations.apply(signal => review.expandContext(request, signal))
  );

  boundary.handle(IPC.REVIEW_HANDOFF, reviewState, (_event, state) => {
    if (operations.finishing) throw new Error('The review is finishing.');
    review.submitReviewState(state);
  });
}
