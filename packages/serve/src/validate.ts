// Request validation for the serve package. Core's handlers assume a caller the
// compiler checked; over HTTP the body is whatever the socket delivered.

import * as fs from 'fs';
import * as path from 'path';
import type { ExpandContextRequest, ReviewState } from '@self-review/core';

/** Realpath the deepest existing ancestor, so a deleted file still resolves. */
function realpathDeepestExisting(absolute: string): string | null {
  const missing: string[] = [];
  let current = absolute;
  for (;;) {
    try {
      const real = fs.realpathSync(current);
      return missing.length === 0 ? real : path.join(real, ...missing);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }
      missing.unshift(path.basename(current));
      current = parent;
    }
  }
}

/**
 * Resolve `candidate` under `root`, or null if it escapes.
 *
 * Never decode here: callers pass a value `searchParams` already decoded once,
 * and decoding again turns `%2E%2E%2F` inside a filename into a real traversal.
 */
export function containPath(root: string, candidate: string): string | null {
  let resolvedRoot: string;
  try {
    resolvedRoot = fs.realpathSync(root);
  } catch {
    return null;
  }

  // Realpath both sides so a symlink inside the repository cannot escape it.
  const resolved = realpathDeepestExisting(path.resolve(resolvedRoot, candidate));
  if (resolved === null) {
    return null;
  }

  if (resolved === resolvedRoot) {
    return resolved;
  }
  // Root plus separator, not a bare prefix: `/repo-evil` is not under `/repo`.
  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  return resolved.startsWith(rootWithSep) ? resolved : null;
}

/**
 * Reaches git as `-U${contextLines}`, so it must be bounded. Matches
 * `MAX_CONTEXT` in useExpandContext.ts; keep the two in step.
 */
export const MAX_CONTEXT_LINES = 99_999;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const EXPAND_CONTEXT_KEYS: ReadonlySet<string> = new Set(['filePath', 'contextLines']);

/**
 * Accepts exactly `{ filePath, contextLines }`. Unknown keys are rejected, not
 * ignored. The route contains `filePath` with `containPath` before git sees it.
 */
export function parseExpandContextBody(body: unknown): ParseResult<ExpandContextRequest> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const record = body as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!EXPAND_CONTEXT_KEYS.has(key)) {
      return { ok: false, error: `unknown field: ${key}` };
    }
  }

  const { filePath, contextLines } = record;
  if (typeof filePath !== 'string') {
    return { ok: false, error: 'filePath must be a string' };
  }
  if (
    typeof contextLines !== 'number' ||
    !Number.isInteger(contextLines) ||
    contextLines < 0 ||
    contextLines > MAX_CONTEXT_LINES
  ) {
    return {
      ok: false,
      error: `contextLines must be an integer between 0 and ${MAX_CONTEXT_LINES}`,
    };
  }

  return { ok: true, value: { filePath, contextLines } };
}

const REVIEW_STATE_KEYS: ReadonlySet<string> = new Set(['timestamp', 'source', 'files']);

/**
 * Accepts exactly `{ timestamp, source, files }`. Remote provenance is never
 * taken from the client; the process injects it after submission.
 *
 * Structural only — the XSD checks nested fields at serialization time. The
 * exception is `id`, checked below, because the serializer turns an id into a
 * file name *before* it validates anything.
 */
export function parseReviewStateBody(body: unknown): ParseResult<ReviewState> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const record = body as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!REVIEW_STATE_KEYS.has(key)) {
      return { ok: false, error: `unknown field: ${key}` };
    }
  }

  const { timestamp, source, files } = record;
  if (typeof timestamp !== 'string') {
    return { ok: false, error: 'timestamp must be a string' };
  }
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    return { ok: false, error: 'source must be an object' };
  }
  if (!Array.isArray(files)) {
    return { ok: false, error: 'files must be an array' };
  }

  const decoded = decodeFileAttachments(files);
  if (!decoded.ok) {
    return decoded;
  }

  return { ok: true, value: { timestamp, source, files: decoded.value } as ReviewState };
}

// Attachment blobs on the wire. `JSON.stringify` renders an ArrayBuffer as
// `{}`, which would write a zero-byte image with a 200 and no error anywhere,
// so the client sends base64 in `dataBase64` and a raw `data` field is refused.

/** Canonical base64: full quartets, with at most one padded tail group. */
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)$/;

const RAW_DATA_ERROR =
  'attachment data must be sent base64-encoded as dataBase64, never as a serialized ArrayBuffer';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Every id this app makes: a randomUUID, or generateId's `${ms}-${base36}`. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * An id becomes an attachment's file name, so `../../x` was a path. Core
 * contains that write too; refusing here fails with a 400 at the door rather
 * than midway through saving, once the review has left the session.
 */
function checkId(entry: Record<string, unknown>, what: string): string | null {
  if (entry.id === undefined) return null;
  if (typeof entry.id !== 'string' || !ID_PATTERN.test(entry.id)) {
    return `${what} id must match ${ID_PATTERN.source}`;
  }
  return null;
}

/**
 * The slice is load-bearing: `Buffer.from` returns a view into Node's shared
 * pool, so handing `.buffer` over whole writes unrelated memory to disk.
 */
function base64ToArrayBuffer(value: string): ArrayBuffer {
  const buffer = Buffer.from(value, 'base64');
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

/** Decode each blob. A resumed attachment carries none and passes through. */
function decodeAttachmentList(list: unknown[]): ParseResult<unknown[]> {
  const decoded: unknown[] = [];
  for (const entry of list) {
    if (!isRecord(entry)) {
      decoded.push(entry);
      continue;
    }
    if (entry.data !== undefined) {
      return { ok: false, error: RAW_DATA_ERROR };
    }
    if (entry.dataBase64 === undefined) {
      decoded.push(entry);
      continue;
    }
    const encoded = entry.dataBase64;
    if (typeof encoded !== 'string' || !BASE64_PATTERN.test(encoded)) {
      // The empty string fails the pattern too: an attachment with no bytes
      // is a zero-byte file on disk, which is the failure being guarded.
      return { ok: false, error: 'attachment dataBase64 must be non-empty base64' };
    }
    const { dataBase64: _encoded, ...rest } = entry;
    decoded.push({ ...rest, data: base64ToArrayBuffer(encoded) });
  }
  return { ok: true, value: decoded };
}

/**
 * Walk the files, decoding blobs and checking every id that becomes a file
 * name. Tolerant of anything it does not recognise, since the XSD checks the
 * document later; strict about the encoding, which the XSD cannot see.
 */
function decodeFileAttachments(files: unknown[]): ParseResult<unknown[]> {
  const decodedFiles: unknown[] = [];
  for (const file of files) {
    if (!isRecord(file) || !Array.isArray(file.comments)) {
      decodedFiles.push(file);
      continue;
    }
    const decodedComments: unknown[] = [];
    for (const comment of file.comments) {
      if (!isRecord(comment)) {
        decodedComments.push(comment);
        continue;
      }
      const commentIdError = checkId(comment, 'comment');
      if (commentIdError) return { ok: false, error: commentIdError };
      const next: Record<string, unknown> = { ...comment };

      if (Array.isArray(comment.attachments)) {
        const result = decodeAttachmentList(comment.attachments);
        if (!result.ok) return result;
        next.attachments = result.value;
      }

      if (Array.isArray(comment.replies)) {
        const decodedReplies: unknown[] = [];
        for (const reply of comment.replies) {
          if (!isRecord(reply)) {
            decodedReplies.push(reply);
            continue;
          }
          const replyIdError = checkId(reply, 'reply');
          if (replyIdError) return { ok: false, error: replyIdError };
          if (!Array.isArray(reply.attachments)) {
            decodedReplies.push(reply);
            continue;
          }
          const result = decodeAttachmentList(reply.attachments);
          if (!result.ok) return result;
          decodedReplies.push({ ...reply, attachments: result.value });
        }
        next.replies = decodedReplies;
      }

      decodedComments.push(next);
    }
    decodedFiles.push({ ...file, comments: decodedComments });
  }
  return { ok: true, value: decodedFiles };
}
