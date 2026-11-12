// HTTP security, responses and bounded JSON decoding. No review policy lives here.

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

type BodyResult = { ok: true; value: unknown } | { ok: false; status: number; error: string };

/**
 * The declared length is checked before a byte is read and the running total
 * during it, so a chunked body without a length is capped too.
 */
export function readJsonBody(
  req: http.IncomingMessage,
  maxBytes: number,
  signal?: AbortSignal
): Promise<BodyResult> {
  const contentType = req.headers['content-type'] ?? '';
  if (contentType.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return Promise.resolve({
      ok: false,
      status: 415,
      error: 'content-type must be application/json',
    });
  }
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > maxBytes) {
    return Promise.resolve({ ok: false, status: 413, error: 'request body too large' });
  }

  return new Promise(resolve => {
    const chunks: Buffer[] = [];
    let received = 0;
    const finish = (result: BodyResult) => {
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      req.off('aborted', onError);
      signal?.removeEventListener('abort', onError);
      chunks.length = 0;
      resolve(result);
    };
    const onData = (chunk: Buffer) => {
      received += chunk.length;
      if (received > maxBytes) {
        finish({ ok: false, status: 413, error: 'request body too large' });
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => {
      try {
        const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
        finish({ ok: true, value });
      } catch {
        finish({ ok: false, status: 400, error: 'body must be valid JSON' });
      }
    };
    const onError = () =>
      finish({ ok: false, status: 400, error: 'request body could not be read' });
    if (signal?.aborted) {
      onError();
      return;
    }
    req.on('data', onData);
    req.once('end', onEnd);
    req.once('error', onError);
    req.once('aborted', onError);
    signal?.addEventListener('abort', onError, { once: true });
  });
}
