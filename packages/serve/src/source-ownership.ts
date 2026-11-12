// A submission describes the loaded review; the browser cannot select a new source.
import {
  capturePublicationOwnership,
  normalizePublicationState,
} from '@self-review/core/validation';
import { ReviewPublishError } from '@self-review/core';
import type { ReviewSession, ReviewState } from '@self-review/core';

export function ownedReviewState(
  session: ReviewSession,
  state: ReviewState,
  outputPath: string,
  ErrorType: typeof ReviewPublishError = ReviewPublishError
): ReviewState {
  const owned = normalizePublicationState(
    state,
    session.diffData,
    capturePublicationOwnership(session.diffData)
  );
  if (!owned)
    throw new ErrorType(
      'validation-failed',
      outputPath,
      'The submitted source does not match the loaded review.'
    );
  return owned;
}
