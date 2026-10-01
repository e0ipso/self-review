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

interface PublishReviewCommonOptions {
  /** Filesystem seam for fault injection; defaults to Node's `fs`. */
  fs?: FsLayer;
  /** Random component of staged asset and temp file names; injectable for tests. */
  randomName?: () => string;
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
 * Attachments that carry `data` are written under fresh names; attachments
 * that only carry a `fileName` are referenced as they are, since their bytes
 * already live wherever the previous document put them.
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

  // 1. The document, and the writes it implies. Nothing has touched the disk.
  let xml: string;
  let assets: PlannedAsset[];
  try {
    const namer = uniqueAssetNamer(assetDir, fs, randomName);
    ({ xml, assets } = await serializeReview(state, target, { assetName: namer }));
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
