// packages/core/src/review-publisher.ts
// The one way a review document reaches the disk. Order is the contract: build and validate,
// stage new assets, then rename the XML into place; a failure before the rename leaves the old files.

import * as path from 'node:path';
import { ReviewXmlError, XmlIllegalCharacterError } from './xml-errors';
import { checkWritability } from './fs-utils';
import { ASSET_DIR_NAME, serializeReview } from './xml-serializer';
import type { PlannedAsset } from './xml-serializer';
import {
  SafeFsError,
  atomicReplace,
  defaultRandomName,
  guarded,
  inspectReplaceTarget,
  lstatOrNull,
  nodeFsLayer,
  toSafeFsError,
  unlinkQuietly,
  writeExclusiveNoFollow,
} from './safe-fs';
import type { FsLayer, SafeFsErrorCode } from './safe-fs';
import { AttachmentRelocationError, relocateAttachments } from './attachment-origins';
import type { AttachmentOrigins } from './attachment-origins';
import type { ReviewState } from './types';

export type ReviewPublishErrorCode =
  /** `details` lists each XSD violation. */
  | 'validation-failed'
  | 'xml-illegal-character'
  | 'output-is-directory'
  | 'permission-denied'
  | 'no-space'
  /** A link where the publisher would write, or an inherited path resolving outside its base. */
  | 'unsafe-link'
  /** A hard-linked output, or a non-directory or foreign-owned asset directory. */
  | 'unsupported-target'
  /** A resumed attachment that must move cannot be read where its document put it. */
  | 'attachment-unavailable'
  | 'io-error';

export class ReviewPublishError extends Error {
  readonly code: ReviewPublishErrorCode;
  readonly path: string;
  /** One rendered line per problem; empty when the message is all there is. */
  readonly details: readonly string[];
  readonly cause?: unknown;

  constructor(
    code: ReviewPublishErrorCode,
    path: string,
    message: string,
    options: { details?: readonly string[]; cause?: unknown } = {}
  ) {
    super(message);
    this.name = 'ReviewPublishError';
    this.code = code;
    this.path = path;
    this.details = options.details ?? [];
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

/** `inherited` paths come from something a repository can commit, so they must stay inside `baseDir`. */
export type ReviewOutputOrigin = 'explicit' | 'inherited';

/** Resolved by `resolveOutputTarget` in `startup.ts`. */
export type ReviewOutputTarget =
  | { path: string; origin: 'explicit' }
  | { path: string; origin: 'inherited'; baseDir: string };

interface PublishReviewCommonOptions {
  fs?: FsLayer;
  randomName?: () => string;
  /** Imported attachments whose origin is elsewhere are copied beside the output (`relocateAttachments`). */
  attachmentOrigins?: AttachmentOrigins;
}

export type PublishReviewOptions = PublishReviewCommonOptions &
  (
    | { outputOrigin: 'explicit' }
    | {
        outputOrigin: 'inherited';
        baseDir: string;
      }
  );

export interface PublishReviewResult {
  outputPath: string;
  /** The attachment files this publication created. */
  assetPaths: string[];
}

/** @throws ReviewPublishError for every failure, document or filesystem. */
export async function publishReview(
  state: ReviewState,
  outputPath: string,
  options: PublishReviewOptions
): Promise<PublishReviewResult> {
  const fs = options.fs ?? nodeFsLayer;
  const randomName = options.randomName ?? defaultRandomName;
  const target = path.resolve(outputPath);
  const outputDir = path.dirname(target);
  const assetDir = path.join(outputDir, ASSET_DIR_NAME);

  // 1. The document and the output policy, from reads alone.
  let xml: string;
  let assets: PlannedAsset[];
  try {
    const publishable = options.attachmentOrigins
      ? await relocateAttachments(state, options.attachmentOrigins, target)
      : state;
    const namer = uniqueAssetNamer(assetDir, fs, randomName);
    ({ xml, assets } = await serializeReview(publishable, target, { assetName: namer }));
    checkOutputPolicy(target, options, fs);
  } catch (error) {
    throw toPublishError(error, target);
  }

  // 2. Stage the new blobs; every file created here is removed on failure.
  const staged: string[] = [];
  try {
    if (assets.length > 0) {
      ensureAssetDirectory(outputDir, fs);
      for (const asset of assets) {
        writeExclusiveNoFollow(asset.absolutePath, new Uint8Array(asset.data), { fs });
        staged.push(asset.absolutePath);
      }
    }

    // 3. The commit point.
    atomicReplace(target, Buffer.from(xml + '\n', 'utf-8'), {
      fs,
      preserveMode: true,
      randomName,
    });
  } catch (error) {
    for (const file of staged) unlinkQuietly(file, fs);
    throw toPublishError(error, target);
  }

  if (staged.length > 0) {
    console.error(`[main] Wrote ${staged.length} attachment file(s) to ${assetDir}`);
  }
  return { outputPath: target, assetPaths: staged };
}

/** The error `publishReview` would throw for the path as it stands; advisory, since the disk can change. */
export function inspectOutputPath(
  outputPath: string,
  options: PublishReviewOptions
): ReviewPublishError | null {
  const fs = options.fs ?? nodeFsLayer;
  const target = path.resolve(outputPath);
  try {
    checkOutputPolicy(target, options, fs);
  } catch (error) {
    return toPublishError(error, target);
  }
  if (!checkWritability(target)) {
    const dir = path.dirname(target);
    return new ReviewPublishError(
      'permission-denied',
      target,
      `Cannot write ${target}: ${dir} does not exist or is not writable`
    );
  }
  return null;
}

/** A file at a drawn name means another draw; a link there is a trap and is refused. */
function uniqueAssetNamer(assetDir: string, fs: FsLayer, randomName: () => string) {
  const chosen = new Set<string>();
  return (idPrefix: string, _index: number, ext: string): string => {
    for (let attempt = 0; attempt < 16; attempt++) {
      const name = `${idPrefix}-${randomName()}.${ext}`;
      if (chosen.has(name)) continue;
      const candidate = path.join(assetDir, name);
      const stats = lstatOrNull(candidate, fs);
      if (stats?.isSymbolicLink()) {
        throw new SafeFsError(
          'unsafe-link',
          candidate,
          `Refusing to write attachment ${candidate}: a symbolic link already sits at that name`
        );
      }
      if (stats === null) {
        chosen.add(name);
        return name;
      }
    }
    throw new SafeFsError(
      'io-error',
      assetDir,
      `Could not find a free attachment name under ${assetDir} after 16 attempts`
    );
  };
}

/** The leaf and, for an inherited path, the containment checks. Reads only. */
function checkOutputPolicy(target: string, options: PublishReviewOptions, fs: FsLayer): void {
  if (options.outputOrigin === 'inherited') {
    const base = path.resolve(options.baseDir);
    const outputDir = path.dirname(target);
    const physicalBase = guarded(base, 'resolve', () => fs.realpathSync(base));
    const physicalDir = guarded(outputDir, 'resolve', () => fs.realpathSync(outputDir));
    const rel = path.relative(physicalBase, physicalDir);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new SafeFsError(
        'unsafe-link',
        target,
        `Refusing to write ${target}: the configured output directory resolves to ${physicalDir}, outside ${physicalBase}. ` +
          'Choose the output path explicitly to save there.'
      );
    }
  }
  // Checked now as well as at write time, so no asset is staged for a document that cannot be published.
  inspectReplaceTarget(target, fs);
}

/** A real directory this user owns. `mkdir` is not recursive: a missing output directory fails the save anyway. */
function ensureAssetDirectory(outputDir: string, fs: FsLayer): void {
  const assetDir = path.join(outputDir, ASSET_DIR_NAME);
  let stats = lstatOrNull(assetDir, fs);
  if (stats === null) {
    guarded(assetDir, 'create attachment directory', () => fs.mkdirSync(assetDir, 0o755));
    stats = guarded(assetDir, 'inspect', () => fs.lstatSync(assetDir));
  }

  if (stats.isSymbolicLink()) {
    throw new SafeFsError(
      'unsafe-link',
      assetDir,
      `Refusing to write attachments through ${assetDir}: it is a symbolic link`
    );
  }
  if (!stats.isDirectory()) {
    throw new SafeFsError(
      'unsupported-target',
      assetDir,
      `Cannot write attachments: ${assetDir} exists but is not a directory`
    );
  }
  const uid = typeof process.getuid === 'function' ? process.getuid() : undefined;
  if (uid !== undefined && stats.uid !== uid) {
    throw new SafeFsError(
      'unsupported-target',
      assetDir,
      `Refusing to write attachments into ${assetDir}: it is owned by another user`
    );
  }
}

const SAFE_FS_TO_PUBLISH: Partial<Record<SafeFsErrorCode, ReviewPublishErrorCode>> = {
  'output-is-directory': 'output-is-directory',
  'permission-denied': 'permission-denied',
  'no-space': 'no-space',
  'unsafe-link': 'unsafe-link',
  'unsupported-target': 'unsupported-target',
};

function toPublishError(error: unknown, target: string): ReviewPublishError {
  if (error instanceof ReviewPublishError) return error;
  if (error instanceof AttachmentRelocationError) {
    return new ReviewPublishError('attachment-unavailable', error.origin, error.message, {
      details: [error.message],
      cause: error,
    });
  }
  if (error instanceof XmlIllegalCharacterError) {
    return new ReviewPublishError('xml-illegal-character', target, error.message, {
      details: [error.message],
      cause: error,
    });
  }
  if (error instanceof ReviewXmlError) {
    return new ReviewPublishError('validation-failed', target, error.message, {
      details: error.details,
      cause: error,
    });
  }
  const fsError = toSafeFsError(error, target, 'write');
  const code = SAFE_FS_TO_PUBLISH[fsError.code] ?? 'io-error';
  return new ReviewPublishError(code, fsError.path, fsError.message, {
    cause: fsError.cause ?? fsError,
  });
}
