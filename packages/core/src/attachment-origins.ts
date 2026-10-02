// packages/core/src/attachment-origins.ts
// Where resumed attachment bytes live, which references may be read, and how they follow a relocated output.

import * as path from 'path';
import { MAX_IMAGE_BYTES } from './input-budgets';
import { readContainedFile, toSafeFsError } from './safe-fs';
import { canonicalSourcePath } from './source-identity';
import type { SafeFsErrorCode } from './safe-fs';
import { ASSET_DIR_NAME } from './xml-serializer';
import type { Attachment, ReviewComment, ReviewState } from './types';

/** Reference as the resumed document wrote it → absolute path beside that document. Session state only. */
export type AttachmentOrigins = ReadonlyMap<string, string>;

export type AttachmentReadFailureReason =
  | 'not-authorized'
  | 'not-found'
  | 'not-regular'
  | 'unsafe-link'
  | 'too-large'
  | 'io-error';

export type AttachmentReadResult =
  | { ok: true; data: ArrayBuffer }
  | { ok: false; reason: AttachmentReadFailureReason; message: string };

/** The bare name in `.self-review-assets/<name>`; null for any other shape. */
export function parseAttachmentReference(reference: unknown): string | null {
  if (typeof reference !== 'string') return null;
  const prefix = `${ASSET_DIR_NAME}/`;
  if (!reference.startsWith(prefix)) return null;
  const name = reference.slice(prefix.length);
  if (name === '' || name === '.' || name === '..') return null;
  if (/[/\\\0]/.test(name)) return null;
  return name;
}

function* attachmentLists(comments: readonly ReviewComment[]) {
  for (const comment of comments) {
    if (comment.attachments) yield { comment, attachments: comment.attachments };
    for (const reply of comment.replies ?? []) {
      if (reply.attachments) yield { comment, attachments: reply.attachments };
    }
  }
}

/** Origins resolve against the resumed document's directory; an unrecorded reference is never read. */
export function resolveAttachmentOrigins(
  comments: readonly ReviewComment[],
  resumeDocumentPath: string
): { origins: Map<string, string>; diagnostics: string[] } {
  const assetDir = path.join(
    canonicalSourcePath(path.dirname(path.resolve(resumeDocumentPath))),
    ASSET_DIR_NAME
  );
  const origins = new Map<string, string>();
  const diagnostics: string[] = [];
  for (const { comment, attachments } of attachmentLists(comments)) {
    for (const attachment of attachments) {
      const name = parseAttachmentReference(attachment.fileName);
      if (name === null) {
        diagnostics.push(
          `${comment.filePath || '(review)'}: attachment "${attachment.fileName}" is not in the ` +
            `document's ${ASSET_DIR_NAME} directory; it will not be loaded`
        );
        continue;
      }
      origins.set(attachment.fileName, path.join(assetDir, name));
    }
  }
  return { origins, diagnostics };
}

const READ_FAILURES: Partial<Record<SafeFsErrorCode, AttachmentReadFailureReason>> = {
  'not-found': 'not-found',
  'unsafe-link': 'unsafe-link',
  'output-is-directory': 'not-regular',
  'not-regular': 'not-regular',
  'too-large': 'too-large',
};

/** Read one asset the caller authorized: the asset directory must not be a link, nor the leaf. */
export async function readAssetFile(assetPath: string): Promise<AttachmentReadResult> {
  const assetDir = path.dirname(assetPath);
  const rel = path.join(path.basename(assetDir), path.basename(assetPath));
  try {
    const content = await readContainedFile(path.dirname(assetDir), rel, MAX_IMAGE_BYTES);
    const data = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
    return { ok: true, data: data as ArrayBuffer };
  } catch (error) {
    const fsError = toSafeFsError(error, assetPath, 'read');
    return {
      ok: false,
      reason: READ_FAILURES[fsError.code] ?? 'io-error',
      message: fsError.message,
    };
  }
}

/** The recorded origin of an imported reference, else the same name in `currentAssetDir`. */
export function authorizeAttachmentReference(
  reference: unknown,
  origins: AttachmentOrigins,
  currentAssetDir: string | null
): string | null {
  const name = parseAttachmentReference(reference);
  if (name === null) return null;
  const origin = origins.get(reference as string);
  if (origin !== undefined) return origin;
  return currentAssetDir ? path.join(currentAssetDir, name) : null;
}

export class AttachmentRelocationError extends Error {
  readonly reference: string;
  readonly origin: string;
  readonly reason: AttachmentReadFailureReason;

  constructor(
    reference: string,
    origin: string,
    reason: AttachmentReadFailureReason,
    detail: string
  ) {
    super(
      `Attachment ${reference} from the resumed review could not be copied beside the new output: ${detail}. ` +
        `Save next to the resumed review, or remove that attachment, and save again.`
    );
    this.name = 'AttachmentRelocationError';
    this.reference = reference;
    this.origin = origin;
    this.reason = reason;
  }
}

/**
 * Give every imported attachment whose origin is not beside `outputPath` its bytes, so the
 * publisher stages a copy. Unreadable ones throw: the old reference would resolve to the wrong file.
 */
export async function relocateAttachments(
  state: ReviewState,
  origins: AttachmentOrigins,
  outputPath: string
): Promise<ReviewState> {
  if (origins.size === 0) return state;
  const targetAssetDir = path.join(
    canonicalSourcePath(path.dirname(path.resolve(outputPath))),
    ASSET_DIR_NAME
  );
  const read = new Map<string, ArrayBuffer>();

  const relocate = async (attachments: Attachment[]): Promise<Attachment[]> => {
    const result: Attachment[] = [];
    for (const attachment of attachments) {
      const origin = attachment.data ? undefined : origins.get(attachment.fileName);
      if (origin === undefined || path.dirname(origin) === targetAssetDir) {
        result.push(attachment);
        continue;
      }
      let data = read.get(origin);
      if (data === undefined) {
        const outcome = await readAssetFile(origin);
        if (!outcome.ok) {
          throw new AttachmentRelocationError(
            attachment.fileName,
            origin,
            outcome.reason,
            outcome.message
          );
        }
        data = outcome.data;
        read.set(origin, data);
      }
      result.push({ ...attachment, data });
    }
    return result;
  };

  const files = [];
  for (const file of state.files) {
    const comments = [];
    for (const comment of file.comments) {
      const next: ReviewComment = { ...comment };
      if (comment.attachments) next.attachments = await relocate(comment.attachments);
      if (comment.replies) {
        next.replies = [];
        for (const reply of comment.replies) {
          next.replies.push(
            reply.attachments ? { ...reply, attachments: await relocate(reply.attachments) } : reply
          );
        }
      }
      comments.push(next);
    }
    files.push({ ...file, comments });
  }
  return { ...state, files };
}
