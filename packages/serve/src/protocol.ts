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

// ---------------------------------------------------------------------------
// The session capability on the wire.
//
// The server draws one secret per process (./capability.ts) and prints the
// launch URL with it in the fragment: `http://127.0.0.1:<port>/#cap=<token>`.
// A fragment is the one part of a URL a browser never sends — not in the
// request line, not in `Referer` — so the page is the only thing that ever
// holds it. The page reads it from `location.hash`, erases it from the
// address bar, and presents it as `Authorization: Bearer <token>` on every
// API request. The server answers 401 to anything else.
// ---------------------------------------------------------------------------

/** The fragment parameter the launch URL carries the capability in. */
export const CAPABILITY_FRAGMENT_KEY = 'cap';

/** The scheme the capability is presented under in `Authorization`. */
export const CAPABILITY_SCHEME = 'Bearer';

/** The launch URL: the listener's URL with the capability in its fragment. */
export function formatLaunchUrl(listenerUrl: string, capability: string): string {
  return `${listenerUrl}#${CAPABILITY_FRAGMENT_KEY}=${capability}`;
}

/**
 * The capability a `location.hash` carries, or null. Parsed as URL
 * parameters so a browser that re-encodes the fragment is still read.
 */
export function parseCapabilityFragment(hash: string): string | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const value = params.get(CAPABILITY_FRAGMENT_KEY);
  return value ? value : null;
}

/** The `Authorization` header value presenting a capability. */
export function capabilityAuthorization(capability: string): string {
  return `${CAPABILITY_SCHEME} ${capability}`;
}

/** One decimal, since the limit itself is a round number of megabytes. */
export function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}
