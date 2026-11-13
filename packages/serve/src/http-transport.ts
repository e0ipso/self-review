// HTTP security, responses and bounded JSON decoding. No review policy lives here.

import { decodeJsonBody, type JsonBodyResult } from './json-body-codec';
import {
  defaultJsonBodyProcessing,
  INLINE_JSON_BODY_BYTES,
  type JsonBodyProcessing,
  type JsonBodyLease,
} from './json-body-processing';
import { SERVER_BUSY_ERROR } from './protocol';
import type * as http from 'node:http';
import { capabilityMatches } from './capability';
import { CAPABILITY_SCHEME } from './protocol';

/**
 * The page renders the diff under review, which is the least trusted input the
 * program handles. Rendered content is sanitized before it becomes elements;
 * this is the second line, for whatever gets past that.
 *
 * Inline styles are allowed because index.html carries a <style> block and
 * bundled libraries inject at runtime; blob: because attachments display
 * through createObjectURL.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'none'",
  "child-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

export const SECURITY_HEADERS: http.OutgoingHttpHeaders = {
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
};

/** A browser may resolve the printed URL either way, or prefer IPv6. */
const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** Lowercased, with an explicit `:80` dropped so it matches the bare host. */
function normalizeHost(value: string): string {
  const lowered = value.toLowerCase();
  return lowered.endsWith(':80') ? lowered.slice(0, -3) : lowered;
}

/**
 * A rebound request — an attacker's name re-resolved to 127.0.0.1 after the
 * page loads — still carries that name in `Host`, which is what distinguishes
 * it from a real one.
 *
 * The port is deliberately not compared against the bound port: an `ssh -L`
 * forward arrives carrying the forward's port, and refusing that would break
 * the use case this package exists for. It would buy nothing either, since a
 * rebound request fails on the hostname first.
 *
 * A duplicate `Host` is refused, not resolved: Node reads the first, and an
 * intermediary forwarding the last would be reading a different request.
 */
function hostIsLoopback(req: http.IncomingMessage): boolean {
  const host = req.headers.host;
  if (host === undefined) return false;

  let seen = 0;
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    if (req.rawHeaders[i].toLowerCase() === 'host') seen++;
  }
  if (seen !== 1) return false;

  // Split the optional port off, keeping an IPv6 literal's brackets.
  const match = /^(\[[^\]]*\]|[^:]*)(?::(\d+))?$/.exec(host);
  if (match === null) return false;
  return LOOPBACK_HOSTNAMES.has(match[1].toLowerCase());
}

/**
 * A missing `Origin` is allowed — navigations and curl send none. Rejected is
 * an `Origin` naming a different authority than `Host`, including the `null` a
 * sandboxed frame sends.
 *
 * Comparing against `Host` rather than a loopback allowlist is what survives a
 * port forward while still refusing another local page: a dev server on :3000
 * sends its own origin and this listener's host, and those differ.
 */
function originMatchesHost(req: http.IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  const host = req.headers.host;
  if (host === undefined) return false;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:') return false;
  // `new URL` parses away userinfo, paths and leading-zero ports, any of which
  // would compare equal to this authority. A browser sends none of them.
  if (origin !== `${parsed.protocol}//${parsed.host}`) return false;
  return normalizeHost(parsed.host) === normalizeHost(host);
}

/**
 * Set by the browser, unforgeable by page script. A cross-site *GET* — an <img>
 * aimed at this port — carries no `Origin`, so without this it would be served
 * and only the absence of CORS headers would stop the page reading it.
 *
 * Non-browser clients send no such header and are unaffected.
 */
function fetchSiteIsSelf(req: http.IncomingMessage): boolean {
  const site = req.headers['sec-fetch-site'];
  if (site === undefined) return true;
  return site === 'same-origin' || site === 'none';
}

export function sendJson(
  res: http.ServerResponse,
  status: number,
  value: unknown,
  headers: http.OutgoingHttpHeaders = {}
): void {
  // Serialize before headers so a failure can still produce a useful error.
  const text = JSON.stringify(value ?? null);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...SECURITY_HEADERS,
    ...headers,
  });
  // `JSON.stringify(undefined)` is undefined; a void core result becomes `null`.
  res.end(text);
}

export function sendError(res: http.ServerResponse, status: number, error: string): void {
  // A body that blew the cap is not read further; close the connection rather
  // than let the rest of it be reinterpreted as a next request.
  sendJson(res, status, { error }, status === 413 ? { connection: 'close' } : {});
}

// Header only: a token in the query string would land in history and logs.
function presentsCapability(req: http.IncomingMessage, capability: string): boolean {
  const header = req.headers.authorization;
  if (header === undefined) return false;
  const space = header.indexOf(' ');
  if (space === -1) return false;
  if (header.slice(0, space).toLowerCase() !== CAPABILITY_SCHEME.toLowerCase()) return false;
  return capabilityMatches(capability, header.slice(space + 1).trim());
}

function sendUnauthorized(res: http.ServerResponse): void {
  sendJson(res, 401, { error: 'unauthorized' }, { 'www-authenticate': CAPABILITY_SCHEME });
}

/** Security checks precede route lookup and operation admission. */
export function allowRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  capability: string
): boolean {
  if (!hostIsLoopback(req) || !originMatchesHost(req) || !fetchSiteIsSelf(req)) {
    sendError(res, 403, 'forbidden');
    return false;
  }
  if (url.pathname.startsWith('/api/') && !presentsCapability(req, capability)) {
    sendUnauthorized(res);
    return false;
  }
  return true;
}

type BodyResult = JsonBodyResult;

/** Original reflected call contract remains the three-argument form. */
export function readJsonBody(
  req: http.IncomingMessage,
  maxBytes: number,
  signal: AbortSignal | undefined,
  processing: JsonBodyProcessing
): Promise<BodyResult>;
export function readJsonBody(
  req: http.IncomingMessage,
  maxBytes: number,
  signal?: AbortSignal
): Promise<BodyResult>;
/** Length checks precede allocation; large bodies reserve worker ownership while collecting. */
export async function readJsonBody(
  req: http.IncomingMessage,
  maxBytes: number,
  signal?: AbortSignal,
  processing: JsonBodyProcessing = defaultJsonBodyProcessing
): Promise<BodyResult> {
  const contentType = req.headers['content-type'] ?? '';
  if (contentType.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return { ok: false, status: 415, error: 'content-type must be application/json' };
  }
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, status: 413, error: 'request body too large' };
  }
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  let tailBytes = 0;
  const ownership: { lease: JsonBodyLease | null } = { lease: null };
  const cancelled = new AbortController();
  const unreadable: BodyResult = {
    ok: false,
    status: 400,
    error: 'request body could not be read',
  };
  let collected!: (result: BodyResult | null) => void;
  const collection = new Promise<BodyResult | null>(resolve => {
    collected = resolve;
  });
  let reading = true;
  const finishCollection = (result: BodyResult | null) => {
    if (!reading) return;
    reading = false;
    req.off('data', onData);
    req.off('end', onEnd);
    collected(result);
  };
  const onError = () => {
    cancelled.abort();
    finishCollection(unreadable);
  };
  const onData = (chunk: Buffer) => {
    received += chunk.length;
    if (received > maxBytes) {
      finishCollection({ ok: false, status: 413, error: 'request body too large' });
      return;
    }
    if (!ownership.lease && received > INLINE_JSON_BODY_BYTES) {
      ownership.lease = processing.reserve(maxBytes);
      if (!ownership.lease) {
        finishCollection({ ok: false, status: 503, error: SERVER_BUSY_ERROR });
        return;
      }
      ownership.lease.signal.addEventListener('abort', onError, { once: true });
      if (ownership.lease.signal.aborted) {
        onError();
        return;
      }
    }
    // Fixed-size owned blocks bound the transfer list even for one-byte stream chunks.
    // Copies are incremental; there is no main-thread full-body concatenation or clone.
    let offset = 0;
    while (offset < chunk.length) {
      let tail = chunks[chunks.length - 1];
      if (!tail || tailBytes === tail.length) {
        tail = new Uint8Array(64 * 1024);
        chunks.push(tail);
        tailBytes = 0;
      }
      const length = Math.min(tail.length - tailBytes, chunk.length - offset);
      tail.set(chunk.subarray(offset, offset + length), tailBytes);
      tailBytes += length;
      offset += length;
    }
  };
  const onEnd = () => finishCollection(null);
  try {
    if (signal?.aborted) return unreadable;
    req.on('data', onData);
    req.once('end', onEnd);
    req.on('error', onError);
    req.once('aborted', onError);
    signal?.addEventListener('abort', onError, { once: true });
    const failure = await collection;
    if (failure) return failure;
    if (cancelled.signal.aborted) return unreadable;
    const last = chunks.length - 1;
    if (last >= 0 && tailBytes < chunks[last].length)
      chunks[last] = chunks[last].slice(0, tailBytes);
    const result = ownership.lease
      ? await ownership.lease.parse(
          chunks.map(chunk => chunk.buffer),
          cancelled.signal
        )
      : decodeJsonBody(chunks);
    return cancelled.signal.aborted ? unreadable : result;
  } finally {
    req.off('data', onData);
    req.off('end', onEnd);
    req.off('error', onError);
    req.off('aborted', onError);
    signal?.removeEventListener('abort', onError);
    ownership.lease?.signal.removeEventListener('abort', onError);
    ownership.lease?.release();
    chunks.length = 0;
  }
}
