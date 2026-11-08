// The session capability. Host/Origin checks cannot tell the reviewer from another local account
// (loopback is shared and a local client can send no browser headers); this secret can.
// The browser side of the contract is in ./protocol.ts.

import { randomBytes, timingSafeEqual } from 'node:crypto';

export function generateCapability(): string {
  return randomBytes(32).toString('base64url');
}

// Constant-time once lengths agree; every capability has the same length, so the length check leaks nothing.
export function capabilityMatches(expected: string, presented: string): boolean {
  const a = Buffer.from(expected, 'utf-8');
  const b = Buffer.from(presented, 'utf-8');
  return a.length === b.length && timingSafeEqual(a, b);
}
