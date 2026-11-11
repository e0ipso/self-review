// One-shot publication admission and recoverable error policy, independent of HTTP.

import { ReviewPublishError } from '@self-review/core';
import type { ReviewState, ReviewPublishErrorCode } from '@self-review/core';
import type { ReviewSubmitAck, ReviewSubmitFailure } from './protocol';

/** A publisher resolves only after commit; a refusal throws without replacing the previous file. */
export interface SubmissionOperations {
  submitReviewState: (state: ReviewState) => void;
  publishReview: (
    state: ReviewState,
    options?: { signal?: AbortSignal }
  ) => Promise<{ outputPath: string }>;
}

export class ReviewSubmission {
  private state: 'open' | 'publishing' | 'published' = 'open';

  constructor(private readonly operations: SubmissionOperations) {}

  get completed(): boolean {
    return this.state === 'published';
  }

  /** Reserve before reading the body, so overlapping uploads cannot both enter publication. */
  begin(): boolean {
    if (this.state !== 'open') return false;
    this.state = 'publishing';
    return true;
  }

  /** Failed parsing, publication or unexpected errors all permit a repaired submission. */
  release(): void {
    if (this.state === 'publishing') this.state = 'open';
  }

  async publish(
    state: ReviewState,
    options?: { signal?: AbortSignal }
  ): Promise<ReviewSubmitAck | ReviewSubmitFailure> {
    this.operations.submitReviewState(state);
    try {
      const { outputPath } = await this.operations.publishReview(state, options);
      this.state = 'published';
      console.error(`[serve] Review written to ${outputPath}`);
      return { ok: true, outputPath };
    } catch (error) {
      if (!(error instanceof ReviewPublishError)) throw error;
      console.error(`[serve] Review not saved (${error.code}): ${error.message}`);
      for (const detail of error.details) console.error(`[serve]   ${detail}`);
      console.error(
        '[serve] The review is still open in the browser. Fix the problem and press Finish Review again.'
      );
      return { ok: false, code: error.code, message: error.message, details: [...error.details] };
    }
  }
}

const DOCUMENT_ERROR_CODES: ReadonlySet<ReviewPublishErrorCode> = new Set([
  'validation-failed',
  'xml-illegal-character',
]);

export function publishFailureStatus(code: ReviewPublishErrorCode): number {
  return DOCUMENT_ERROR_CODES.has(code) ? 422 : 500;
}
