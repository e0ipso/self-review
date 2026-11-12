// Browser attachment encoding preserves the established base64 wire format.
import type { Attachment, ReviewState } from '@self-review/core';
/** `String.fromCharCode` is applied to a slice at a time; spreading a whole
 * multi-megabyte screenshot in one call overflows the argument stack. */
const BASE64_CHUNK_BYTES = 0x8000;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_BYTES) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_BYTES));
  }
  return btoa(binary);
}

/**
 * Encode one attachment list for the wire. An attachment with no blob — a
 * resumed one, whose bytes are read back through `GET /api/attachment` —
 * passes through as it is.
 */
function encodeAttachments(attachments: Attachment[]): unknown[] {
  return attachments.map(attachment => {
    const { data, ...rest } = attachment;
    if (!data || data.byteLength === 0) return rest;
    return { ...rest, dataBase64: arrayBufferToBase64(data) };
  });
}

/**
 * Rewrite a review state into the JSON body `POST /api/review` accepts:
 * attachment blobs base64-encoded, and only the three top-level fields the
 * server takes (it rejects an unknown key with 400, and remote provenance is
 * injected server-side, exactly as the desktop injects it in main).
 */
export function encodeReviewStateForWire(state: ReviewState): unknown {
  return {
    timestamp: state.timestamp,
    source: state.source,
    files: state.files.map(file => ({
      ...file,
      comments: file.comments.map(comment => ({
        ...comment,
        ...(comment.attachments ? { attachments: encodeAttachments(comment.attachments) } : {}),
        ...(comment.replies
          ? {
              replies: comment.replies.map(reply => ({
                ...reply,
                ...(reply.attachments ? { attachments: encodeAttachments(reply.attachments) } : {}),
              })),
            }
          : {}),
      })),
    })),
  };
}
