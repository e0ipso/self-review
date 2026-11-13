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
import type { ResolvedAttachmentLocation, AttachmentReadResult } from './attachment-origins';
import { ASSET_DIR_NAME } from './xml-serializer';
import type { DiagnosticReporter } from './diagnostics';
import { isolatedReporter } from './effect-diagnostics';

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
};

export interface LoadImageOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Defaults to stderr. Reporter failures never change the read outcome. */
  reportDiagnostic?: DiagnosticReporter;
}

/**
 * Reads a reviewed, previewable path. First-party loads pin index blobs and verify physical
 * source evidence; legacy injected identities retain live descriptor reads.
 */
export async function loadImage(
  session: Pick<ReviewSession, 'reviewedPaths' | 'diffData' | 'sourceIdentity' | 'loadedReview'>,
  filePath: string,
  options: LoadImageOptions = {}
): Promise<ImageLoadResult> {
  if (!session.reviewedPaths.has(filePath)) {
    return { error: 'Image preview unavailable — this file is not part of the reviewed diff.' };
  }
  if (!isPreviewableImage(filePath)) {
    return { error: 'Image preview unavailable — this file is not a previewable image.' };
  }
  const located = locateReviewedFile(session, filePath);
  const side = located?.side ?? 'new';

  const { sourceIdentity, reviewedPaths, loadedReview } = session;
  const result = await readReviewedContent(
    { sourceIdentity, reviewedPaths, loadedReview },
    filePath,
    side,
    {
      ...options,
      maxBytes: MAX_IMAGE_BYTES,
    }
  );
  if (
    session.sourceIdentity !== sourceIdentity ||
    session.reviewedPaths !== reviewedPaths ||
    session.loadedReview !== loadedReview
  )
    return { error: 'Image preview unavailable — the loaded review changed.' };
  if (!result.ok) {
    if (result.reason === 'too-large') {
      return { error: 'File too large to preview (>10 MB)' };
    }
    isolatedReporter(options.reportDiagnostic)(
      `[review] Image preview unavailable for ${filePath}: ${result.message}`
    );
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
  resumeDocumentPath: string,
  location: ResolvedAttachmentLocation
): string[];
export function recordResumedAttachments(
  session: Pick<ReviewSession, 'attachmentOrigins'>,
  comments: readonly ReviewComment[],
  resumeDocumentPath: string
): string[];
export function recordResumedAttachments(
  session: Pick<ReviewSession, 'attachmentOrigins'>,
  comments: readonly ReviewComment[],
  resumeDocumentPath: string,
  location: ResolvedAttachmentLocation | undefined = undefined
): string[] {
  const { origins, diagnostics } =
    location === undefined
      ? resolveAttachmentOrigins(comments, resumeDocumentPath)
      : resolveAttachmentOrigins(comments, resumeDocumentPath, location);
  session.attachmentOrigins = origins;
  return diagnostics;
}

/** Authorized asset reads only. Implementations enforce no-follow, regular-file and byte limits. */
export interface AttachmentReader {
  readAssetFile(
    assetPath: string,
    options: { signal?: AbortSignal }
  ): Promise<AttachmentReadResult>;
}

export interface ReadAttachmentOptions {
  signal?: AbortSignal;
  /** Authoritative when supplied. Failures never retry through the native reader. */
  attachmentReader?: AttachmentReader;
  /** Defaults to stderr. Throwing or rejecting reporters cannot change the read outcome. */
  reportDiagnostic?: DiagnosticReporter;
}

// Refusals accept unknown input. Do not invoke toJSON/getters or serialize an unbounded object.
function refusedReferenceLabel(reference: unknown): string {
  if (typeof reference === 'string') return JSON.stringify(reference.slice(0, 512));
  if (reference === null) return 'null';
  return `[${typeof reference}]`;
}

/**
 * Read one attachment by its `.self-review-assets/<name>` reference, never a path:
 * an imported one from its recorded origin, any other from the current output's asset
 * directory. Anything else is `not-authorized` and touches nothing.
 */
export async function readAttachment(
  session: Pick<ReviewSession, 'outputPathInfo' | 'attachmentOrigins'>,
  reference: unknown,
  options: ReadAttachmentOptions = {}
): Promise<AttachmentReadResult> {
  const checkCancelled = () => {
    if (options.signal?.aborted)
      throw new CommandCancelledError('aborted', 'self-review', ['read-attachment']);
  };
  checkCancelled();
  const reportDiagnostic = isolatedReporter(options.reportDiagnostic);
  const outputPath = session.outputPathInfo?.resolvedOutputPath;
  const currentAssetDir = outputPath ? path.join(path.dirname(outputPath), ASSET_DIR_NAME) : null;
  const assetPath = authorizeAttachmentReference(
    reference,
    session.attachmentOrigins,
    currentAssetDir
  );
  if (assetPath === null) {
    reportDiagnostic(`[attachment:read] Refused: ${refusedReferenceLabel(reference)}`);
    checkCancelled();
    return {
      ok: false,
      reason: 'not-authorized',
      message: `Attachments are read only from the review's ${ASSET_DIR_NAME} directory`,
    };
  }
  let result: AttachmentReadResult;
  try {
    result = options.attachmentReader
      ? await options.attachmentReader.readAssetFile(assetPath, { signal: options.signal })
      : await readAssetFile(assetPath, { signal: options.signal });
  } catch (error) {
    checkCancelled();
    throw error;
  }
  checkCancelled();
  if (!result.ok) {
    reportDiagnostic(`[attachment:read] ${result.reason}: ${result.message}`);
    checkCancelled();
  }
  return result;
}
