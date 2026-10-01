// The part of the HTTP contract both ends must agree on, kept in a module
// with no Node dependency so the browser bundle can import it too.
//
// The server enforces the body limit; the client checks it before sending,
// so an oversized review is refused with the work still in the page rather
// than after the socket has been closed on it. One constant, two readers.

import type { ReviewPublishErrorCode } from '@self-review/core';

/**
 * Upper bound on a `POST /api/review` body. Generous but finite: an unbounded
 * read is a trivial denial of service. Attachments ride base64-encoded, so a
 * review's size on the wire is about four thirds of its image bytes.
 */
export const MAX_REVIEW_BODY_BYTES = 32 * 1024 * 1024;

/**
 * What a 200 from `POST /api/review` carries. It is sent only after the
 * document has been published: the file named here exists when this arrives.
 */
export interface ReviewSubmitAck {
  ok: true;
  /** The absolute path the review was written to. */
  outputPath: string;
}

/**
 * What `POST /api/review` answers when the document could not be published.
 * The server stays up and the same review can be submitted again once the
 * problem named here has been fixed.
 */
export interface ReviewSubmitFailure {
  ok: false;
  /** The publisher's code; `details` has one rendered line per problem. */
  code: ReviewPublishErrorCode;
  message: string;
  details: string[];
}

/** The client's own code for a body it refused to send, and for the server's 413. */
export const REVIEW_TOO_LARGE_CODE = 'review-too-large';

/** One decimal, since the limit itself is a round number of megabytes. */
export function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}
