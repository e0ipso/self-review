import type { PublicationOperations, SubmissionOperations } from './review-submission';

/** Original injected operations may populate a dependent cache during handoff. */
export function legacyPublication(operations: SubmissionOperations): PublicationOperations {
  return {
    publishReview: async (state, options) => {
      operations.submitReviewState(state);
      return operations.publishReview(state, options);
    },
  };
}
