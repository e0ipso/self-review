import { publishReview, ReviewPublishError } from '../../packages/core/src/review-publisher';
import {
  capturePublicationOwnership,
  normalizePublicationState,
} from '../../packages/core/src/publication-ownership';
import { applyRemoteProvenance } from '../../packages/core/src/remote-mode';
import { validateReviewState } from '../../packages/core/src/review-state-validation';
import { publicationOptions, type DesktopSession } from './desktop-session';
import type { ReviewState } from '../shared/types';
import type { ReviewPublication } from './lifecycle-handlers';

/** Capture at admission, before waiting for Apply or any other asynchronous work. */
export function captureDesktopPublication(
  review: Pick<DesktopSession['review'], 'diffData'>,
  outputPath: string
): (state: ReviewState) => ReviewState {
  const admitted = capturePublicationOwnership(review.diffData);
  return state => {
    const owned = normalizePublicationState(state, review.diffData, admitted);
    if (!owned)
      throw new ReviewPublishError(
        'validation-failed',
        outputPath,
        'The review state does not belong to the current review.'
      );
    return owned;
  };
}

/** The concrete writer repeats ownership validation even for direct/legacy callers. */
export function createDesktopPublication(desktop: DesktopSession): ReviewPublication {
  return {
    async publish(state, signal) {
      const owned = captureDesktopPublication(
        desktop.review,
        desktop.output.path
      )(validateReviewState(state));
      const remote = desktop.review.diffData?.remote;
      // Keep desktop's remote-only XML source form without losing source extension metadata.
      const finalState = remote
        ? {
            ...applyRemoteProvenance(owned, remote),
            source: { ...owned.source, type: 'welcome' as const },
          }
        : owned;
      await publishReview(finalState, desktop.output.path, {
        ...publicationOptions(desktop),
        signal,
      });
      // A diagnostic failure cannot change a committed result into a retryable failure.
      try {
        console.error(`[main] Review written to ${desktop.output.path}`);
      } catch {
        // The output has committed.
      }
    },
  };
}
