// The session capability: one secret per process, drawn here and compared
// here. Node only — the browser side of the same contract (the fragment the
// token travels in, the header it is presented in) lives in ./protocol.ts.
//
// Host, Origin and Fetch Metadata tell a web page from the reviewer's own
// tab. None of them tells the reviewer from another account on the same
// machine: loopback is shared by every user, and a local client can name
// the listener in `Host` and send no browser headers at all. The capability
// is what does that. It is delivered once, in the launch URL's fragment,
// which a browser never sends to any server.

import { randomBytes, timingSafeEqual } from 'node:crypto';

/** 256 bits, base64url: no padding, nothing a URL fragment would alter. */
export function generateCapability(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Whether a presented token is the session's. Constant-time once the
 * lengths agree; the length check leaks nothing a wrong token does not
 * already know, since every capability is the same length.
 */
export function capabilityMatches(expected: string, presented: string): boolean {
  const a = Buffer.from(expected, 'utf-8');
  const b = Buffer.from(presented, 'utf-8');
  return a.length === b.length && timingSafeEqual(a, b);
}
