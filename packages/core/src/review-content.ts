// Snapshot image previews and authorized attachment reads for a review session.
import path from 'path';
import { CommandCancelledError } from './forge-provider';
import type { ImageLoadResult, ReviewComment } from './types';
import type { ReviewSession } from './review-session';
import { locateReviewedFile } from './review-session';
import { MAX_IMAGE_BYTES } from './input-budgets';
import { isPreviewableImage } from './file-type-utils';
import { readReviewedContent } from './snapshot-reader';
import {
  authorizeAttachmentReference,
  readAssetFile,
  resolveAttachmentOrigins,
} from './attachment-origins';
import type { AttachmentReadResult } from './attachment-origins';
import { ASSET_DIR_NAME } from './xml-serializer';

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
};

/**
 * Reads from the snapshot the review compared, never the current working tree; only reviewed,
 * previewable paths are read.
 */
export async function loadImage(
  session: Pick<ReviewSession, 'reviewedPaths' | 'diffData' | 'sourceIdentity'>,
  filePath: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<ImageLoadResult> {
  if (!session.reviewedPaths.has(filePath)) {
    return { error: 'Image preview unavailable — this file is not part of the reviewed diff.' };
  }
  if (!isPreviewableImage(filePath)) {
    return { error: 'Image preview unavailable — this file is not a previewable image.' };
  }
  const located = locateReviewedFile(session, filePath);
  const side = located?.side ?? 'new';

  const result = await readReviewedContent(session, filePath, side, {
    ...options,
    maxBytes: MAX_IMAGE_BYTES,
  });
  if (!result.ok) {
    if (result.reason === 'too-large') {
      return { error: 'File too large to preview (>10 MB)' };
    }
    console.error(`[review] Image preview unavailable for ${filePath}: ${result.message}`);
    return { error: `Image preview unavailable — ${result.message}` };
  }
  const mimeType = IMAGE_MIME_TYPES[path.posix.extname(filePath).toLowerCase()];
  return { dataUri: `data:${mimeType};base64,${result.content.toString('base64')}` };
}

/**
 * Records that resumed attachments live beside the resumed document, whatever the
 * launch directory or save location. Returns one diagnostic per reference that is
 * not `.self-review-assets/<name>` and so will never be read.
 */
export function recordResumedAttachments(
  session: Pick<ReviewSession, 'attachmentOrigins'>,
  comments: readonly ReviewComment[],
  resumeDocumentPath: string
): string[] {
  const { origins, diagnostics } = resolveAttachmentOrigins(comments, resumeDocumentPath);
  session.attachmentOrigins = origins;
  return diagnostics;
}

/**
 * Read one attachment by its `.self-review-assets/<name>` reference, never a path:
 * an imported one from its recorded origin, any other from the current output's asset
 * directory. Anything else is `not-authorized` and touches nothing.
 */
export async function readAttachment(
  session: Pick<ReviewSession, 'outputPathInfo' | 'attachmentOrigins'>,
  reference: unknown,
  options: { signal?: AbortSignal } = {}
): Promise<AttachmentReadResult> {
  const checkCancelled = () => {
    if (options.signal?.aborted)
      throw new CommandCancelledError('aborted', 'self-review', ['read-attachment']);
  };
  checkCancelled();
  const outputPath = session.outputPathInfo?.resolvedOutputPath;
  const currentAssetDir = outputPath ? path.join(path.dirname(outputPath), ASSET_DIR_NAME) : null;
  const assetPath = authorizeAttachmentReference(
    reference,
    session.attachmentOrigins,
    currentAssetDir
  );
  if (assetPath === null) {
    console.error(`[attachment:read] Refused: ${JSON.stringify(reference)}`);
    return {
      ok: false,
      reason: 'not-authorized',
      message: `Attachments are read only from the review's ${ASSET_DIR_NAME} directory`,
    };
  }
  let result: AttachmentReadResult;
  try {
    result = await readAssetFile(assetPath, { signal: options.signal });
  } catch (error) {
    checkCancelled();
    throw error;
  }
  checkCancelled();
  if (!result.ok) {
    console.error(`[attachment:read] ${result.reason}: ${result.message}`);
  }
  return result;
}
