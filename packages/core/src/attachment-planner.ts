// Pure attachment naming and document planning. Never reads or writes files.
import * as path from 'node:path';
import type { Attachment, ReviewState } from './types';

function extFromMediaType(mediaType: string): string {
  // Same reasoning as `assetNameComponent`: anything not in the map falls
  // back to png, including a value that is not a string at all.
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[mediaType] || 'png';
}

/**
 * Reduce an id to something that can only ever name a file *inside* the asset
 * directory.
 *
 * A comment id is not trusted input. The desktop gets its ReviewState from its
 * own renderer, but the serve front end accepts a whole document over HTTP, so
 * `../../x` in an id would walk this function's write out of the asset
 * directory and onto an arbitrary path. Every id this app generates is a UUID,
 * so restricting the prefix to the URL-safe alphabet renames nothing in
 * practice and leaves existing asset names byte-identical.
 */
function assetNameComponent(idPrefix: string): string {
  // Coerced rather than assumed: this runs before the document is validated
  // against anything, so a caller that omits an id reaches here with
  // `undefined`, and a bare `.replace` would turn that into a crash *after*
  // the review has already been taken off the session — losing it. The
  // serializer's job here is to name a file, not to police the document.
  return String(idPrefix ?? '').replace(/[^A-Za-z0-9_-]/g, '_');
}

export const ASSET_DIR_NAME = '.self-review-assets';

export interface PlannedAsset {
  /** As emitted in the document: `.self-review-assets/<name>`. */
  relativePath: string;
  absolutePath: string;
  data: ArrayBuffer;
}

/**
 * `idPrefix` is already URL-safe; the result must be a bare file name. The publisher injects unique
 * names so a new document never overwrites an asset the previous one references.
 */
export type AssetNamer = (idPrefix: string, index: number, ext: string) => string;

export interface SerializedReview {
  /** Validated, without a trailing newline. */
  xml: string;
  /** Blobs the document references that nothing has written yet. */
  assets: PlannedAsset[];
}

export const defaultAssetName: AssetNamer = (idPrefix, index, ext) => `${idPrefix}-${index}.${ext}`;

interface AssetLocation {
  relativePath: string;
  absolutePath: string;
}

type AssetSource = { data: ArrayBuffer } | { origin: string; reference: string };
export type PublicationAsset = AssetLocation & AssetSource;

/** Public serialization keeps its existing in-memory planned-asset result. */
export function planAttachments(
  state: ReviewState,
  outputFilePath: string,
  assetName: AssetNamer
): { state: ReviewState; assets: PlannedAsset[] } {
  return planDocument(state, outputFilePath, assetName, attachment =>
    attachment.data ? { data: attachment.data } : null
  );
}

/** Plan imported references without loading their bytes. Repeated origins share one new asset. */
export function planPublicationAttachments(
  state: ReviewState,
  outputFilePath: string,
  assetName: AssetNamer,
  origins: ReadonlyMap<string, string>,
  targetAssetDir: string
): { state: ReviewState; assets: PublicationAsset[] } {
  return planDocument<AssetSource>(state, outputFilePath, assetName, attachment => {
    if (attachment.data) return { data: attachment.data };
    const origin = origins.get(attachment.fileName);
    return origin === undefined || path.dirname(origin) === targetAssetDir
      ? null
      : { origin, reference: attachment.fileName };
  });
}

function planDocument<T extends AssetSource>(
  state: ReviewState,
  outputFilePath: string,
  assetName: AssetNamer,
  sourceFor: (attachment: Attachment) => T | null
): { state: ReviewState; assets: (AssetLocation & T)[] } {
  const assetDir = path.join(path.dirname(outputFilePath), ASSET_DIR_NAME);
  const assets: (AssetLocation & T)[] = [];
  const imported = new Map<string, AssetLocation & T>();
  const planList = (attachments: Attachment[] | undefined, idPrefix: string) =>
    attachments?.map((attachment, index) => {
      const source = sourceFor(attachment);
      if (source === null) return attachment;
      let asset = 'origin' in source ? imported.get(source.origin) : undefined;
      if (!asset) {
        const name = assetName(
          assetNameComponent(idPrefix),
          index,
          extFromMediaType(attachment.mediaType)
        );
        const absolutePath = path.join(assetDir, name);
        if (path.dirname(path.resolve(absolutePath)) !== path.resolve(assetDir)) {
          throw new Error(`Refusing to write an attachment outside ${assetDir}: ${name}`);
        }
        asset = { ...source, absolutePath, relativePath: `${ASSET_DIR_NAME}/${name}` };
        assets.push(asset);
        if ('origin' in source) imported.set(source.origin, asset);
      }
      return { ...attachment, fileName: asset.relativePath, data: undefined };
    });
  const files = state.files.map(file => ({
    ...file,
    comments: file.comments.map(comment => ({
      ...comment,
      attachments: planList(comment.attachments, comment.id),
      ...(comment.replies
        ? {
            replies: comment.replies.map(reply => ({
              ...reply,
              attachments: planList(reply.attachments, `${comment.id}-r-${reply.id}`),
            })),
          }
        : {}),
    })),
  }));
  return { state: { ...state, files }, assets };
}
