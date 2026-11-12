// Decode HTTP attachment bytes without applying review DTO policy.

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Attachment blobs on the wire. `JSON.stringify` renders an ArrayBuffer as
// `{}`, which would write a zero-byte image with a 200 and no error anywhere,
// so the client sends base64 in `dataBase64` and a raw `data` field is refused.

/** Canonical base64: full quartets, with at most one padded tail group. */
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)$/;

const RAW_DATA_ERROR =
  'attachment data must be sent base64-encoded as dataBase64, never as a serialized ArrayBuffer';

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
 * name. Leave other nested values for the shared runtime validator; only this
 * transport understands base64 fields and serialized ArrayBuffer mistakes.
 */
export function decodeFileAttachments(files: unknown[]): ParseResult<unknown[]> {
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
