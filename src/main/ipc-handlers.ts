// Compatibility entry and capability composition. Engine operations are bound by main.
import { IPC } from '../shared/ipc-channels';
import type { ReviewSession } from '../../packages/core/src/review-handlers';
import { bindDesktopReviewOperations, type DesktopReviewOperations } from './review-operations';
import { createIpcBoundary, noArgument, stringArgument } from './ipc-boundary';
import { DesktopOperations } from './desktop-operations';
import { ReviewTransition } from './review-transition';
import { DirectorySelection } from './directory-selection';
import type { ReviewPresentation } from './presentation';
import { registerContentHandlers } from './content-ipc';
import { registerSuggestionHandlers } from './suggestion-ipc';
import { registerApplicationHandlers } from './application-ipc';
import { registerFindHandlers } from './find-in-page';
import { startDirectoryReview } from './directory-review';
export { sendDiffLoad, sendConfigLoad, sendResumeLoad, sendGuideLoad } from './ipc-delivery';
export { registerFindInPageForWindow } from './find-in-page';

export function registerIpcHandlers(
  desktopSession: ReviewSession,
  boundary: ReturnType<typeof createIpcBoundary>,
  transition: ReviewTransition,
  presentation: ReviewPresentation,
  operations = new DesktopOperations(),
  review: DesktopReviewOperations = bindDesktopReviewOperations(desktopSession)
): void {
  registerContentHandlers(review, boundary, operations);
  registerSuggestionHandlers(review, boundary, operations, presentation);
  registerApplicationHandlers(boundary, operations, presentation);
  registerFindHandlers(boundary);
  const selection = new DirectorySelection(transition, boundary.capture, event =>
    presentation.pickDirectory(boundary.assertPeer(event))
  );
  boundary.handle(IPC.DIALOG_PICK_DIRECTORY, noArgument, event =>
    operations.read(() => selection.choose(event), 10 * 60_000)
  );
  boundary.handle(IPC.REVIEW_START_DIRECTORY, stringArgument, (event, directoryPath) =>
    operations.read(
      signal =>
        startDirectoryReview(
          event,
          directoryPath,
          signal,
          review,
          boundary,
          transition,
          selection,
          presentation
        ),
      10 * 60_000
    )
  );
}
