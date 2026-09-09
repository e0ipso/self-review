// Request validation for the serve package.
//
// Every route validates its input here before calling into @self-review/core.
// The core handlers were written for an in-process caller the TypeScript
// compiler had already checked; over HTTP the body is whatever the socket
// delivered, and types do not exist at runtime. Issue #145 (repository-
// controlled strings reaching `git` through a shell) is the standing evidence
// that this boundary is not hypothetical in this repository.
//
// This module deliberately starts no subprocess and touches no shell.

import * as fs from 'fs';
import * as path from 'path';
import type { ExpandContextRequest, ReviewState } from '@self-review/core';

/**
 * Resolve symlinks in `absolute` even when the final path does not exist
 * (a deleted or renamed file in the diff): realpath the deepest existing
 * ancestor and re-append the missing tail. Returns `null` only when nothing
 * on the path can be resolved.
 */
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
 * Resolve `candidate` against `root` and return the resolved absolute path
 * when it is the root itself or sits strictly beneath it; otherwise `null`.
 *
 * Performs NO decoding. Callers pass an already-decoded value: the server
 * reads paths via `searchParams.get()`, which has decoded exactly once. A
 * second decode would turn an encoded traversal sequence inside a legitimate
 * filename (`%2E%2E%2F`) into a real one. Never decode here.
 */
export function containPath(root: string, candidate: string): string | null {
  let resolvedRoot: string;
  try {
    resolvedRoot = fs.realpathSync(root);
  } catch {
    return null;
  }

  // Resolve both sides to real paths so a symlink inside the repository
  // cannot point outside it.
  const resolved = realpathDeepestExisting(path.resolve(resolvedRoot, candidate));
  if (resolved === null) {
    return null;
  }

  if (resolved === resolvedRoot) {
    return resolved;
  }
  // Compare against the root plus a separator, not a bare string prefix:
  // `/repo-evil` must not be accepted as being under `/repo`.
  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  return resolved.startsWith(rootWithSep) ? resolved : null;
}

/**
 * Upper bound for `contextLines` on the expand-context route.
 *
 * The value reaches `git diff` as `-U${contextLines}`, so it must be a bounded
 * integer, never a raw `number`. 99_999 is exactly what the shipped React
 * client sends to expand a whole file (`useExpandContext.ts`, `MAX_CONTEXT`),
 * so the bound admits every value the real client produces and nothing larger.
 * It is also far below the point where a JavaScript number stringifies in
 * exponent notation (1e21), which would hand git an argument like `-U1e+21`.
 * Keep this in step with the client constant if either ever changes.
 */
export const MAX_CONTEXT_LINES = 99_999;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const EXPAND_CONTEXT_KEYS: ReadonlySet<string> = new Set(['filePath', 'contextLines']);

/**
 * Validate the JSON body of `POST /api/expand-context`.
 *
 * Accepts exactly `{ filePath: string, contextLines: integer in [0, MAX] }`.
 * Any other key is rejected rather than ignored, so a field that some future
 * handler might read can never ride along unchecked. `filePath` is only
 * type-checked here; the route contains it under the repository root with
 * `containPath` before it reaches git.
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
 * Validate the JSON body of `POST /api/review`.
 *
 * Accepts exactly what the review panel submits — `{ timestamp, source,
 * files }` (see `useReviewBridge.getReviewState`). Remote provenance
 * (`remoteUrl`, `remoteHeadSha`, ...) is never accepted from the client: the
 * desktop injects it main-side after submission, and the serve process does
 * the same, so an unknown key is rejected rather than forwarded.
 *
 * Mostly a structural check: the full document is validated against the XSD
 * when it is serialized, which is where every nested field is checked, and
 * here the aim is that `submitReviewState` never sees a body it cannot even
 * read. The exception is `id`, which is checked in the walk below because
 * deferring it to the XSD does not work — an id names a file that the
 * serializer writes to disk *before* it validates anything.
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

// ---------------------------------------------------------------------------
// Attachment blobs on the wire.
//
// `Attachment.data` is an `ArrayBuffer`, and `JSON.stringify` renders one as
// `{}` — so a review submitted with an image would validate, store, serialize
// and write a zero-byte file, with a 200 and no error anywhere. The browser
// client therefore sends the bytes base64-encoded in `dataBase64`
// (`encodeReviewStateForWire` in ./client/adapter.ts) and this is where they
// are turned back into the `ArrayBuffer` the XML serializer writes to disk.
//
// The two sides are covered together by a round-trip test, and a raw `data`
// field is rejected outright rather than passed along, so a client that
// forgets to encode fails loudly instead of writing empty images.
// ---------------------------------------------------------------------------

/** Canonical base64: full quartets, with at most one padded tail group. */
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)$/;

const RAW_DATA_ERROR =
  'attachment data must be sent base64-encoded as dataBase64, never as a serialized ArrayBuffer';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Comment and reply ids, as this application produces them: either a
 * `crypto.randomUUID()` (the renderer) or `${Date.now()}-${base36}`
 * (`generateId` in core's xml-parser, used for every comment read back from a
 * resumed document). Both are covered by the URL-safe alphabet. Ids are never
 * written to the XML, so a resumed document never carries a foreign one in.
 */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Reject an id that is not one this application could have produced.
 *
 * The serializer names each attachment file after the id of the comment or
 * reply that owns it, and writes that file before the document is validated
 * against the XSD — so `../../x` as an id used to place an attacker-chosen
 * file at an attacker-chosen path, and did it whether or not the document
 * that carried it was ever valid. Core contains that write on its own now;
 * this is the boundary half of the same fix, and it is here rather than there
 * because this is the only entry point where the id arrives off a socket.
 *
 * An absent id is left alone. It still reaches the serializer, which coerces
 * it and contains the name it produces, so the file cannot escape — the point
 * of rejecting a *present* id here is to fail at the door with a 400 rather
 * than midway through saving, after the review has left the session.
 */
function checkId(entry: Record<string, unknown>, what: string): string | null {
  if (entry.id === undefined) return null;
  if (typeof entry.id !== 'string' || !ID_PATTERN.test(entry.id)) {
    return `${what} id must match ${ID_PATTERN.source}`;
  }
  return null;
}

/**
 * Decode base64 into a standalone `ArrayBuffer`.
 *
 * The slice is load-bearing: for a small payload `Buffer.from` returns a view
 * into Node's shared 8 KB allocation pool, so handing `.buffer` over whole
 * would attach kilobytes of unrelated memory to the attachment — and the
 * serializer writes exactly what it is given.
 */
function base64ToArrayBuffer(value: string): ArrayBuffer {
  const buffer = Buffer.from(value, 'base64');
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

/**
 * Rebuild one `attachments` array with every blob decoded. Entries that carry
 * no blob — a resumed attachment, whose bytes are read back through
 * `GET /api/attachment` — pass through untouched.
 */
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
 * Walk the submitted files, decoding attachment blobs and checking every id
 * the serializer will turn into a file name.
 *
 * Deliberately tolerant of everything else: this function only recognizes the
 * `files[].comments[].attachments[]` and `files[].comments[].replies[]
 * .attachments[]` shapes and leaves anything it does not recognize exactly as
 * sent, because the whole document is validated against the XSD at
 * serialization time. The one thing it is strict about is the encoding.
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
