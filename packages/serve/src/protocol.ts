// The HTTP contract both ends share; no Node dependency so the browser bundle can import it.

import type { ReviewPublishErrorCode } from '@self-review/core';

/**
 * Upper bound on a `POST /api/review` body. The client checks it too, so an oversized review is
 * refused with the work still in the page. Attachments ride base64, about 4/3 of their bytes.
 */
export const MAX_REVIEW_BODY_BYTES = 32 * 1024 * 1024;

/** A 200 from `POST /api/review`, sent only after the document is published. */
export interface ReviewSubmitAck {
  ok: true;
  /** The absolute path the review was written to. */
  outputPath: string;
}

/** `POST /api/review` when publishing failed; the server stays up for a retry. */
export interface ReviewSubmitFailure {
  ok: false;
  /** The publisher's code; `details` has one rendered line per problem. */
  code: ReviewPublishErrorCode;
  message: string;
  details: string[];
}

/** The client's own code for a body it refused to send, and for the server's 413. */
export const REVIEW_TOO_LARGE_CODE = 'review-too-large';

// The capability travels only in the launch URL's fragment (`/#cap=<token>`), which a browser never sends
// (not even in `Referer`). The page moves it into `Authorization: Bearer` on every API request.
export const CAPABILITY_FRAGMENT_KEY = 'cap';

export const CAPABILITY_SCHEME = 'Bearer';

export function formatLaunchUrl(listenerUrl: string, capability: string): string {
  return `${listenerUrl}#${CAPABILITY_FRAGMENT_KEY}=${capability}`;
}

// Parsed as URL parameters so a browser that re-encodes the fragment is still read.
export function parseCapabilityFragment(hash: string): string | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const value = params.get(CAPABILITY_FRAGMENT_KEY);
  return value ? value : null;
}

export function capabilityAuthorization(capability: string): string {
  return `${CAPABILITY_SCHEME} ${capability}`;
}

export function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}
