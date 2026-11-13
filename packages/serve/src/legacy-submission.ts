import type { PublicationOperations, SubmissionOperations } from './review-submission';

/** Original injected operations may populate a dependent cache during handoff.
 * Retain this ordering while the original SubmissionOperations API is supported.
 */
export function legacyPublication(operations: SubmissionOperations): PublicationOperations {
  return {
    publicationError: operations.publicationError,
    publishReview: async (state, options) => {
      operations.submitReviewState(state);
      return operations.publishReview(state, options);
    },
  };
}
