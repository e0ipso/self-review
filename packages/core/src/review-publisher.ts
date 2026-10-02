// packages/core/src/review-publisher.ts
// The one way a review document reaches the disk. The desktop app, the
// serve CLI and fetch-comments all hand their ReviewState here; none of
// them writes review XML or attachment bytes itself.
//
// The order is the contract. The whole document is built from the in-memory
// state and validated before any filesystem side effect; only then are new
// attachment blobs staged under `.self-review-assets/` beside the output,
// each under a fresh unique name created exclusively and without following
// links; and only then is the XML written to a same-directory temp file,
// synced, and renamed over the output path. The rename is the commit point.
// A failure anywhere before it removes only what this attempt staged and
// leaves the previous document and every asset it references untouched.
// A crash between staging and the rename leaves unreferenced asset files
// and a `.review.xml.<random>.tmp` behind, never a damaged document.
//
// Failures are reported as ReviewPublishError with a code a host can act on
// and every validation problem rendered as text. Library code throws; the
// host decides what to show and whether to exit.

import * as path from 'node:path';
import { ReviewXmlError, XmlIllegalCharacterError } from './xml-errors';
import { checkWritability } from './fs-utils';
import { ASSET_DIR_NAME, serializeReview } from './xml-serializer';
import type { PlannedAsset } from './xml-serializer';
import {
  SafeFsError,
  atomicReplace,
  defaultRandomName,
  errnoOf,
  inspectReplaceTarget,
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
  /** The document fails the v3 XSD; `details` lists each violation. */
  | 'validation-failed'
  /** A value carries a character XML 1.0 cannot represent; the message names it. */
  | 'xml-illegal-character'
  /** The output path is a directory. */
  | 'output-is-directory'
  /** The operating system refused the write (EACCES, EPERM, EROFS). */
  | 'permission-denied'
  /** The disk or quota is full (ENOSPC, EDQUOT). */
  | 'no-space'
  /**
   * A symbolic link sits where the publisher would write (the output leaf,
   * the asset directory or a staged asset name), or an inherited output path
   * resolves outside its base directory.
   */
  | 'unsafe-link'
  /**
   * The output or asset directory exists in a form the publisher will not
   * replace: a hard-linked output, a non-directory or foreign-owned asset
   * directory.
   */
  | 'unsupported-target'
  /**
   * A resumed attachment has to be copied beside an output in another
   * directory, and its bytes cannot be read where the resumed document put
   * them. Publishing the old reference would point at nothing, or at an
   * unrelated file of the same name, so nothing is written.
   */
  | 'attachment-unavailable'
  /** Any other filesystem failure; `cause` carries the original error. */
  | 'io-error';

export class ReviewPublishError extends Error {
  readonly code: ReviewPublishErrorCode;
  /** The path the failure is about: the output file, or the asset that failed. */
  readonly path: string;
  /** One rendered line per individual problem; empty when the message is all there is. */
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

/**
 * Where the output path came from, which decides how much the publisher
 * trusts it.
 *
 * - `explicit`: the reviewer named it (a CLI flag, the save dialog). It may
 *   point anywhere, inside the project or not. A symlink at the leaf is
 *   still refused rather than followed: a save that silently lands
 *   somewhere other than the named file is not what a reviewer chose.
 * - `inherited`: it came from project configuration or the default, which a
 *   repository can commit. It must stay physically inside `baseDir` (the
 *   realpath of its parent under the realpath of the base), and a symlink at
 *   the leaf is refused, so a committed `.self-review.yaml` or a committed
 *   `review.xml` link cannot redirect the save.
 */
export type ReviewOutputOrigin = 'explicit' | 'inherited';

/**
 * Where a session publishes its review, fixed by startup (and, on the
 * desktop, replaced by the save dialog): the absolute path and the origin
 * the publisher trusts it under. An inherited path carries the directory
 * it must stay inside, which is the launch directory. Resolved by
 * `resolveOutputTarget` in `startup.ts` from the same configuration
 * provenance in every host.
 */
export type ReviewOutputTarget =
  | { path: string; origin: 'explicit' }
  | { path: string; origin: 'inherited'; baseDir: string };

interface PublishReviewCommonOptions {
  /** Filesystem seam for fault injection; defaults to Node's `fs`. */
  fs?: FsLayer;
  /** Random component of staged asset and temp file names; injectable for tests. */
  randomName?: () => string;
  /**
   * Where the session's resumed attachments live (`ReviewSession.attachmentOrigins`).
   * An imported attachment whose origin is not the new output's asset
   * directory has its bytes read from there and is staged as a new asset,
   * so the published reference resolves; one already beside the output
   * keeps its reference. Omitted or empty: every reference is kept as given.
   */
  attachmentOrigins?: AttachmentOrigins;
}

export type PublishReviewOptions = PublishReviewCommonOptions &
  (
    | { outputOrigin: 'explicit' }
    | {
        outputOrigin: 'inherited';
        /** The directory the inherited output path must stay inside, usually the launch cwd. */
        baseDir: string;
      }
  );

export interface PublishReviewResult {
  /** The absolute path the document was written to. */
  outputPath: string;
  /** Absolute paths of the attachment files this publication created. */
  assetPaths: string[];
}

/**
 * Validate the complete review, stage its new attachments, and publish the
 * XML atomically. See the module comment for the ordering guarantees.
 *
 * `outputPath` is resolved against the current directory if relative; hosts
 * pass it absolute. The document is written with a trailing newline, as
 * every host did before this existed, so output stays byte-identical.
 *
 * Attachments that carry `data` are written under fresh names. An attachment
 * that only carries a `fileName` is referenced as it is when its bytes
 * already sit beside the output, or when `attachmentOrigins` does not know
 * it; an imported one whose origin is elsewhere is read from that origin
 * and written under a fresh name, like a new one (see `attachmentOrigins`).
 *
 * @throws ReviewPublishError for every failure, document or filesystem.
 */
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

  // 1. The document, and the writes it implies. Nothing has been written:
  // relocation only reads the resumed attachments that must move.
  let xml: string;
  let assets: PlannedAsset[];
  try {
    const publishable = options.attachmentOrigins
      ? await relocateAttachments(state, options.attachmentOrigins, target)
      : state;
    const namer = uniqueAssetNamer(assetDir, fs, randomName);
    ({ xml, assets } = await serializeReview(publishable, target, { assetName: namer }));
  } catch (error) {
    throw toPublishError(error, target);
  }

  // 2. Output leaf policy, from reads alone, before any asset is staged.
  try {
    checkOutputPolicy(target, options, fs);
  } catch (error) {
    throw toPublishError(error, target);
  }

  // 3. Stage the new blobs. Every file created here is removed on failure.
  const staged: string[] = [];
  try {
    if (assets.length > 0) {
      ensureAssetDirectory(outputDir, fs);
      for (const asset of assets) {
        writeExclusiveNoFollow(asset.absolutePath, new Uint8Array(asset.data), { fs });
        staged.push(asset.absolutePath);
      }
    }

    // 4. The commit point.
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

/**
 * The publisher's read-only checks, for a host that wants to warn before the
 * reviewer has anything to lose: the output leaf policy (directory, symlink,
 * hard link), the inherited-path containment rule, and whether the output
 * directory exists and is writable. Returns the error `publishReview` would
 * throw for the path as it stands, or `null`.
 *
 * A `null` is advisory, not a promise: the disk can change between the probe
 * and the save, so `publishReview` runs the same checks again and the host
 * must still handle its errors. The directory check uses `access(2)` rather
 * than the injectable layer because it is a probe, not a write.
 */
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

/**
 * Names each staged asset `<id>-<random>.<ext>`, checking that nothing
 * exists at the name yet. A regular file there just means another draw; a
 * symlink there is refused outright, because a link at a name only this
 * process should be choosing is a trap, not a coincidence.
 */
function uniqueAssetNamer(assetDir: string, fs: FsLayer, randomName: () => string) {
  const chosen = new Set<string>();
  return (idPrefix: string, _index: number, ext: string): string => {
    for (let attempt = 0; attempt < 16; attempt++) {
      const name = `${idPrefix}-${randomName()}.${ext}`;
      if (chosen.has(name)) continue;
      const candidate = path.join(assetDir, name);
      let exists: boolean;
      try {
        const stats = fs.lstatSync(candidate);
        if (stats.isSymbolicLink()) {
          throw new SafeFsError(
            'unsafe-link',
            candidate,
            `Refusing to write attachment ${candidate}: a symbolic link already sits at that name`
          );
        }
        exists = true;
      } catch (error) {
        if (error instanceof SafeFsError) throw error;
        if (errnoOf(error) !== 'ENOENT') throw toSafeFsError(error, candidate, 'inspect');
        exists = false;
      }
      if (!exists) {
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
    let physicalBase: string;
    let physicalDir: string;
    try {
      physicalBase = fs.realpathSync(base);
    } catch (error) {
      throw toSafeFsError(error, base, 'resolve');
    }
    try {
      physicalDir = fs.realpathSync(outputDir);
    } catch (error) {
      throw toSafeFsError(error, outputDir, 'resolve');
    }
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
  // Symlink at the leaf, directory, hard links: the same policy the replace
  // applies at write time, checked now so no asset is staged for a document
  // that cannot be published.
  inspectReplaceTarget(target, fs);
}

/**
 * `.self-review-assets` beside the output must be a real directory this user
 * owns. It is created when missing; a symlink, another kind of file, or a
 * directory owned by someone else is refused, and nothing is written into
 * it. `mkdir` is not recursive on purpose: the output directory itself must
 * already exist, or the document could not be written either.
 */
function ensureAssetDirectory(outputDir: string, fs: FsLayer): void {
  const assetDir = path.join(outputDir, ASSET_DIR_NAME);

  let stats;
  try {
    stats = fs.lstatSync(assetDir);
  } catch (error) {
    if (errnoOf(error) !== 'ENOENT') throw toSafeFsError(error, assetDir, 'inspect');
    try {
      fs.mkdirSync(assetDir, 0o755);
    } catch (mkdirError) {
      throw toSafeFsError(mkdirError, assetDir, 'create attachment directory');
    }
    try {
      stats = fs.lstatSync(assetDir);
    } catch (error) {
      throw toSafeFsError(error, assetDir, 'inspect');
    }
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

const SAFE_FS_TO_PUBLISH: Record<SafeFsErrorCode, ReviewPublishErrorCode> = {
  'output-is-directory': 'output-is-directory',
  'permission-denied': 'permission-denied',
  'no-space': 'no-space',
  'unsafe-link': 'unsafe-link',
  'unsupported-target': 'unsupported-target',
  // The publisher never passes an expected identity, so this cannot surface;
  // mapped rather than left to a cast so the record stays total.
  'identity-changed': 'io-error',
  'io-error': 'io-error',
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
  if (error instanceof SafeFsError) {
    return new ReviewPublishError(SAFE_FS_TO_PUBLISH[error.code], error.path, error.message, {
      cause: error.cause ?? error,
    });
  }
  const wrapped = toSafeFsError(error, target, 'write');
  return new ReviewPublishError(SAFE_FS_TO_PUBLISH[wrapped.code], target, wrapped.message, {
    cause: error,
  });
}
