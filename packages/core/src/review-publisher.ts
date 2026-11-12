// packages/core/src/review-publisher.ts
// The one way a review document reaches the disk. Order is the contract: build and validate,
// stage new assets, then rename the XML into place; a failure before the rename leaves the old files.

import type { DiagnosticReporter } from './diagnostics';
import { isolatedReporter } from './effect-diagnostics';
import { resolvePublicationFileSystem } from './publication-fs';
import type { PublicationFileSystem, PublicationInspection } from './publication-fs';
import * as path from 'node:path';
import { validateReviewForSerialization } from './review-state-validation';
import { ReviewXmlError, XmlIllegalCharacterError } from './xml-errors';
import { checkWritability } from './fs-utils';
import { serializePlannedReview } from './xml-serializer';
import { ASSET_DIR_NAME, planPublicationAttachments } from './attachment-planner';
import type { PublicationAsset } from './attachment-planner';
import { MAX_IMAGE_BYTES, MAX_PUBLICATION_ASSET_BYTES, formatBytes } from './input-budgets';
import {
  atomicReplaceAsync,
  readContainedFileAsync,
  writeExclusiveNoFollowAsync,
} from './safe-fs-async';
import {
  SafeFsError,
  defaultRandomName,
  guarded,
  inspectReplaceTarget,
  lstatOrNull,
  toSafeFsError,
} from './safe-fs';
import type { FsLayer, SafeFsErrorCode } from './safe-fs';
import { AttachmentRelocationError } from './attachment-origins';
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
  /** Per-call diagnostics, including XML validation. Defaults to stderr. Must not throw. */
  reportDiagnostic?: DiagnosticReporter;
  fs?: FsLayer;
  /** Explicit asynchronous effects, authoritative over fs when both are supplied. */
  publicationFs?: PublicationFileSystem;
  randomName?: () => string;
  /** Imported attachments whose origin is elsewhere are copied beside the output (`relocateAttachments`). */
  attachmentOrigins?: AttachmentOrigins;
  /** Checked during preparation, between bounded read/write chunks and immediately before rename.
   * Legacy synchronous adapters cannot preempt a single syscall; without readSync their readFileSync
   * allocation is guarded by pre/post size checks rather than a hard allocation bound. Cancellation throws
   * ReviewPublishError (`io-error`, with the signal reason as cause). A completed
   * rename is never rolled back. */
  signal?: AbortSignal;
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
  const effects = resolvePublicationFileSystem(options);
  const fs = effects.inspection;
  const asyncFs = effects.files;
  const reportDiagnostic = isolatedReporter(options.reportDiagnostic);
  const randomName = options.randomName ?? defaultRandomName;
  const target = path.resolve(outputPath);
  const outputDir = path.dirname(target);
  const assetDir = path.join(outputDir, ASSET_DIR_NAME);
  const assertActive = () => {
    if (options.signal?.aborted) {
      throw new ReviewPublishError(
        'io-error',
        target,
        `Publication of ${target} was cancelled before saving`,
        { cause: options.signal.reason }
      );
    }
  };
  assertActive();

  // 1. The document and the output policy, from reads alone.
  let xml: string;
  let assets: PublicationAsset[];
  try {
    state = validateReviewForSerialization(state);
    checkOutputPolicy(target, options, fs);
    const targetAssetDir = options.attachmentOrigins?.size
      ? path.join(fs.realpathSync(outputDir), ASSET_DIR_NAME)
      : assetDir;
    const plan = planPublicationAttachments(
      state,
      target,
      uniqueAssetNamer(assetDir, fs, randomName),
      options.attachmentOrigins ?? new Map(),
      targetAssetDir
    );
    assets = plan.assets;
    xml = await serializePlannedReview(plan.state, reportDiagnostic);
    assertActive();
    checkOutputPolicy(target, options, fs);
  } catch (error) {
    assertActive();
    throw toPublishError(error, target);
  }

  // 2. Only references are retained by the plan. Disk-derived bytes live for one asset at a time.
  const staged: string[] = [];
  let remaining = MAX_PUBLICATION_ASSET_BYTES;
  try {
    // Recheck mutable/resizable buffers after asynchronous validation. Fix each view's length so
    // later growth cannot increase what an in-flight write consumes.
    const inline = new Map<PublicationAsset, Uint8Array>();
    for (const asset of assets) {
      if ('data' in asset) {
        const length = new Uint8Array(asset.data).byteLength;
        if (length > MAX_IMAGE_BYTES || length > remaining) {
          const message =
            `Attachment bytes exceed the ${formatBytes(MAX_IMAGE_BYTES)} per-image or ` +
            `${formatBytes(MAX_PUBLICATION_ASSET_BYTES)} publication asset limit`;
          throw new ReviewXmlError('invalid-state', message, { details: [message] });
        }
        inline.set(asset, new Uint8Array(asset.data, 0, length));
        remaining -= length;
      }
    }
    for (const asset of assets) {
      assertActive();
      let bytes: Uint8Array;
      if ('data' in asset) bytes = inline.get(asset)!;
      else {
        try {
          const content = await readContainedFileAsync(
            path.dirname(path.dirname(asset.origin)),
            path.join(path.basename(path.dirname(asset.origin)), path.basename(asset.origin)),
            Math.min(MAX_IMAGE_BYTES, remaining),
            asyncFs,
            options.signal
          );
          bytes = content;
        } catch (error) {
          assertActive();
          const safe = toSafeFsError(error, asset.origin, 'read');
          const reason = attachmentReadReason(safe.code);
          throw new AttachmentRelocationError(
            asset.reference,
            asset.origin,
            reason,
            reason === 'too-large' && remaining < MAX_IMAGE_BYTES
              ? `The publication asset budget has ${formatBytes(remaining)} remaining. ${safe.message}`
              : safe.message
          );
        }
        assertActive();
        remaining -= bytes.byteLength;
      }
      assertActive();
      await ensureAssetDirectory(outputDir, effects);
      await writeExclusiveNoFollowAsync(asset.absolutePath, bytes, {
        fs: asyncFs,
        signal: options.signal,
      });
      staged.push(asset.absolutePath);
    }
    assertActive();
    // 3. Rename is the commit boundary. No abort check or fallible cleanup may follow success.
    await atomicReplaceAsync(target, Buffer.from(xml + '\n', 'utf-8'), {
      fs: asyncFs,
      signal: options.signal,
      beforeCommit: assertActive,
      preserveMode: true,
      randomName,
    });
  } catch (error) {
    for (const file of staged) {
      try {
        await asyncFs.unlink(file);
      } catch {
        /* Rollback must not replace the primary failure. */
      }
    }
    // Async I/O may throw the signal reason directly. Preserve the public cancellation error.
    assertActive();
    throw toPublishError(error, target);
  }

  if (staged.length > 0) {
    reportDiagnostic(`[main] Wrote ${staged.length} attachment file(s) to ${assetDir}`);
  }
  return { outputPath: target, assetPaths: staged };
}

/** The error `publishReview` would throw for the path as it stands; advisory, since the disk can change. */
export function inspectOutputPath(
  outputPath: string,
  options: PublishReviewOptions
): ReviewPublishError | null {
  const fs = resolvePublicationFileSystem(options).inspection;
  const target = path.resolve(outputPath);
  try {
    checkOutputPolicy(target, options, fs);
  } catch (error) {
    return toPublishError(error, target);
  }
  if (!checkWritability(target, fs)) {
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
function uniqueAssetNamer(
  assetDir: string,
  fs: Pick<PublicationInspection, 'lstatSync'>,
  randomName: () => string
) {
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
function checkOutputPolicy(
  target: string,
  options: PublishReviewOptions,
  fs: PublicationInspection
): void {
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
async function ensureAssetDirectory(
  outputDir: string,
  effects: PublicationFileSystem
): Promise<void> {
  const fs = effects.inspection;
  const assetDir = path.join(outputDir, ASSET_DIR_NAME);
  let stats = lstatOrNull(assetDir, fs);
  if (stats === null) {
    await effects.mkdir(assetDir, 0o755).catch(error => {
      throw toSafeFsError(error, assetDir, 'create attachment directory');
    });
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
  const uid = effects.currentUid();
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
  // atomicReplace wraps a refused rename in a filesystem error. Keep the
  // publisher's typed cancellation rather than relabeling it as an I/O failure.
  if (error instanceof SafeFsError && error.cause instanceof ReviewPublishError) return error.cause;
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

function attachmentReadReason(code: SafeFsErrorCode) {
  switch (code) {
    case 'not-found':
    case 'unsafe-link':
    case 'too-large':
    case 'not-regular':
      return code;
    case 'output-is-directory':
      return 'not-regular';
    default:
      return 'io-error';
  }
}
