// packages/core/src/attachment-origins.ts
// Where a review's attachment bytes come from, who may read them, and how
// they follow the document when it is published somewhere else.
//
// A review document names each attachment by a reference relative to the
// document itself — always `.self-review-assets/<name>`, the only shape the
// serializer writes. Three rules follow from that:
//
// - Provenance. An attachment imported from a resumed document lives beside
//   *that document*, not beside the launch directory or the current output.
//   Its origin is recorded once, at import, as an absolute path in session
//   state; the document and the renderer keep the relative reference.
// - Authorization. A read names a reference, never a path. Only the
//   `.self-review-assets/<name>` shape is accepted, and it resolves against
//   the recorded origin or, for a reference the import did not record, the
//   current output's asset directory. The asset directory must be a real
//   directory, the leaf is opened without following links, and only a
//   regular file within the image budget is read.
// - Relocation. Publishing to a directory other than an attachment's origin
//   carries the bytes (read through the same authorized reader) into the
//   publisher, which stages them as new assets beside the new document, so
//   every published reference resolves to the bytes it was imported with.
//   A save to the origin's own directory keeps the reference as it was.

import * as fs from 'fs';
import * as path from 'path';
import { readFileWithinBudget } from './bounded-read';
import { MAX_IMAGE_BYTES, formatBytes } from './input-budgets';
import { errnoOf } from './safe-fs';
import { ASSET_DIR_NAME } from './xml-serializer';
import type { Attachment, ReviewComment, ReviewState } from './types';

/**
 * Attachment reference, exactly as the resumed document wrote it, to the
 * absolute path of its bytes beside that document. Session state only; it
 * never reaches the XML or the renderer.
 */
export type AttachmentOrigins = ReadonlyMap<string, string>;

export type AttachmentReadFailureReason =
  /** The reference is not one this session may read. */
  | 'not-authorized'
  /** Nothing is there (or the asset directory is not a directory). */
  | 'not-found'
  /** A directory, FIFO, socket or device: nothing was read. */
  | 'not-regular'
  /** A symlink at the asset directory or at the attachment name. */
  | 'unsafe-link'
  /** Larger than `MAX_IMAGE_BYTES`. */
  | 'too-large'
  | 'io-error';

export type AttachmentReadResult =
  | { ok: true; data: ArrayBuffer }
  | { ok: false; reason: AttachmentReadFailureReason; message: string };

/**
 * The bare asset file name `reference` names, or null when it is not exactly
 * `.self-review-assets/<name>`: absolute paths, traversal, nested
 * directories, backslashes and NUL bytes are all refused.
 */
export function parseAttachmentReference(reference: unknown): string | null {
  if (typeof reference !== 'string') return null;
  const prefix = `${ASSET_DIR_NAME}/`;
  if (!reference.startsWith(prefix)) return null;
  const name = reference.slice(prefix.length);
  if (name === '' || name === '.' || name === '..') return null;
  if (/[/\\\0]/.test(name)) return null;
  return name;
}

/** The physical form of `dir` when it exists, its absolute form otherwise. */
function physicalDir(dir: string): string {
  const absolute = path.resolve(dir);
  try {
    return fs.realpathSync(absolute);
  } catch {
    return absolute;
  }
}

/** Every attachment list in a set of comments, replies included. */
function* attachmentLists(comments: readonly ReviewComment[]) {
  for (const comment of comments) {
    if (comment.attachments) yield { comment, attachments: comment.attachments };
    for (const reply of comment.replies ?? []) {
      if (reply.attachments) yield { comment, attachments: reply.attachments };
    }
  }
}

/**
 * Resolve the origin of every attachment a resumed document references,
 * against the directory of the document itself (`resumeDocumentPath`,
 * resolved against the current directory if relative). A reference that is
 * not `.self-review-assets/<name>` is not recorded, so nothing will ever
 * read it; one diagnostic line per such reference says so.
 */
export function resolveAttachmentOrigins(
  comments: readonly ReviewComment[],
  resumeDocumentPath: string
): { origins: Map<string, string>; diagnostics: string[] } {
  const assetDir = path.join(
    physicalDir(path.dirname(path.resolve(resumeDocumentPath))),
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

function failure(
  reason: AttachmentReadFailureReason,
  message: string
): { ok: false; reason: AttachmentReadFailureReason; message: string } {
  return { ok: false, reason, message };
}

/** lstat that reports a missing entry as null instead of throwing. */
async function lstatOrNull(target: string): Promise<fs.Stats | null> {
  try {
    return await fs.promises.lstat(target);
  } catch (error) {
    if (errnoOf(error) === 'ENOENT' || errnoOf(error) === 'ENOTDIR') return null;
    throw error;
  }
}

/**
 * Read one asset file the caller has already authorized. The directory that
 * holds it must be a real directory (not a link to one) before and after the
 * read, with the same identity; the leaf is opened `O_NOFOLLOW` and
 * non-blocking, and only a regular file of at most `MAX_IMAGE_BYTES` is read.
 */
export async function readAssetFile(assetPath: string): Promise<AttachmentReadResult> {
  const assetDir = path.dirname(assetPath);
  try {
    const before = await lstatOrNull(assetDir);
    if (before === null) {
      return failure('not-found', `${assetPath} does not exist`);
    }
    if (before.isSymbolicLink()) {
      return failure(
        'unsafe-link',
        `${assetDir} is a symbolic link; attachments are not read through it`
      );
    }
    if (!before.isDirectory()) {
      return failure('not-found', `${assetDir} is not a directory`);
    }

    let read: Awaited<ReturnType<typeof readFileWithinBudget>>;
    try {
      read = await readFileWithinBudget(assetPath, MAX_IMAGE_BYTES, { noFollow: true });
    } catch (error) {
      const code = errnoOf(error);
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        return failure('not-found', `${assetPath} does not exist`);
      }
      if (code === 'ELOOP' || code === 'EMLINK') {
        return failure('unsafe-link', `${assetPath} is a symbolic link; it is not followed`);
      }
      throw error;
    }

    const after = await lstatOrNull(assetDir);
    if (
      after === null ||
      after.isSymbolicLink() ||
      after.dev !== before.dev ||
      after.ino !== before.ino
    ) {
      return failure('unsafe-link', `${assetDir} changed while ${assetPath} was being read`);
    }

    if (read.kind === 'not-regular') {
      return failure('not-regular', `${assetPath} is not a regular file`);
    }
    if (read.kind === 'too-large') {
      return failure(
        'too-large',
        `${assetPath} is ${formatBytes(read.size)}, over the ${formatBytes(MAX_IMAGE_BYTES)} attachment limit`
      );
    }
    const { content } = read;
    const data = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
    return { ok: true, data: data as ArrayBuffer };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return failure('io-error', `Could not read ${assetPath}: ${reason}`);
  }
}

/**
 * The file an attachment reference authorizes, or null when it authorizes
 * none: the recorded origin of an imported reference, else the same name in
 * `currentAssetDir` (the current output's asset directory) when there is one.
 */
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

/** An imported attachment that must be copied to the new output and cannot be read. */
export class AttachmentRelocationError extends Error {
  /** The reference as the resumed document wrote it. */
  readonly reference: string;
  /** Where its bytes were expected. */
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
 * The state to publish at `outputPath`, with every imported attachment that
 * lives somewhere else carrying its bytes, so the publisher stages a copy
 * beside the new document. An attachment that already carries bytes, one
 * the import did not record, and one whose origin is the new output's own
 * asset directory are left exactly as they are.
 *
 * Reads only; the input state is not modified.
 *
 * @throws AttachmentRelocationError when an attachment that has to move
 *   cannot be read: publishing its old reference would point at nothing,
 *   or at whatever unrelated file has that name beside the new output.
 */
export async function relocateAttachments(
  state: ReviewState,
  origins: AttachmentOrigins,
  outputPath: string
): Promise<ReviewState> {
  if (origins.size === 0) return state;
  const targetAssetDir = path.join(
    physicalDir(path.dirname(path.resolve(outputPath))),
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
