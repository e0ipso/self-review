// One-shot publication admission and recoverable error policy, independent of HTTP.

import { ReviewPublishError } from '@self-review/core';
import type { ReviewState, ReviewPublishErrorCode } from '@self-review/core';
import type { ReviewSubmitAck, ReviewSubmitFailure } from './protocol';
import { legacyPublication } from './legacy-submission';
import { nonThrowingReporter } from './diagnostic-reporter';

/** A publisher resolves only after commit; a refusal throws without replacing the previous file. */
export interface PublicationOperations {
  /** Optional for original operation sets; selected with the engine that publishes. */
  publicationError?: typeof ReviewPublishError;
  publishReview: (
    state: ReviewState,
    options?: { signal?: AbortSignal }
  ) => Promise<{ outputPath: string }>;
}

/** Original handoff/publication contract, including handoff side effects and ordering. */
export interface SubmissionOperations extends PublicationOperations {
  submitReviewState: (state: ReviewState) => void;
}
export interface PublicationRole {
  publication: PublicationOperations;
}

export class ReviewSubmission {
  private state: 'open' | 'publishing' | 'published' = 'open';

  private readonly operations: PublicationOperations;
  private readonly report: ReturnType<typeof nonThrowingReporter>;

  constructor(operations: SubmissionOperations, reportDiagnostic?: (message: string) => void);
  constructor(role: PublicationRole, reportDiagnostic?: (message: string) => void);
  constructor(
    input: SubmissionOperations | PublicationRole,
    reportDiagnostic?: (message: string) => void
  ) {
    this.operations = 'submitReviewState' in input ? legacyPublication(input) : input.publication;
    this.report = nonThrowingReporter(reportDiagnostic);
  }

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
    try {
      const { outputPath } = await this.operations.publishReview(state, options);
      this.state = 'published';
      this.report(`[serve] Review written to ${outputPath}`);
      return { ok: true, outputPath };
    } catch (error) {
      if (!(error instanceof (this.operations.publicationError ?? ReviewPublishError))) throw error;
      this.report(`[serve] Review not saved (${error.code}): ${error.message}`);
      for (const detail of error.details) this.report(`[serve]   ${detail}`);
      this.report(
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
