import { IPC } from '../shared/ipc-channels';
import type { createIpcBoundary } from './ipc-boundary';
import { noArgument, suggestionRequest } from './ipc-boundary';
import type { DesktopReviewOperations } from './review-operations';
import type { DesktopOperations } from './desktop-operations';
import type { ReviewPresentation } from './presentation';
import type {
  SuggestionApplyRequest,
  SuggestionApplyOutcome,
  ApplyDestinationOutcome,
} from '../shared/types';
export function registerSuggestionHandlers(
  review: Pick<
    DesktopReviewOperations,
    'applySuggestion' | 'captureSnapshot' | 'setApplyDestination'
  >,
  boundary: ReturnType<typeof createIpcBoundary>,
  operations: DesktopOperations,
  presentation: Pick<ReviewPresentation, 'pickDirectory'>
) {
  // Handle applying one suggestion to the reviewed working file
  boundary.handle(
    IPC.SUGGESTION_APPLY,
    suggestionRequest,
    (event, request: SuggestionApplyRequest): Promise<SuggestionApplyOutcome> => {
      const current = boundary.capture(event);
      const snapshot = review.captureSnapshot();
      return operations.apply(signal => {
        current();
        snapshot();
        signal.throwIfAborted();
        return review.applySuggestion(request, signal);
      });
    }
  );

  // Handle the reviewer naming a destination directory for applies. Only a
  // temporary-clone remote review needs one; the picker is opened here, so
  // the renderer never names a directory the app then writes into.
  boundary.handle(
    IPC.SUGGESTION_CHOOSE_DESTINATION,
    noArgument,
    async (event): Promise<ApplyDestinationOutcome> =>
      operations.apply(async signal => {
        const current = boundary.capture(event);
        const snapshot = review.captureSnapshot();
        const win = boundary.assertPeer(event);
        const path = await presentation.pickDirectory(win, true);
        if (path === null) return { status: 'cancelled' };
        current();
        signal.throwIfAborted();
        snapshot();
        return review.setApplyDestination(path);
      })
  );
}
