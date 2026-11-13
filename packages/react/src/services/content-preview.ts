import type { DiffFile } from '@self-review/types';
import {
  getRenderedTextMode,
  isPreviewableImage,
  isPreviewableSvg,
  type RenderedTextMode,
} from '../utils/file-type-utils';

export type ContentPreview =
  | { kind: 'none' }
  | { kind: 'image' }
  | { kind: 'svg' }
  | { kind: 'text'; mode: RenderedTextMode };

/** Eligibility and default mode are shared by the header and the content dispatcher. */
export function getContentPreview(file: DiffFile): ContentPreview {
  if (file.changeType !== 'added') return { kind: 'none' };
  const path = file.newPath || file.oldPath;
  if (file.isBinary && isPreviewableImage(path)) return { kind: 'image' };
  if (isPreviewableSvg(path)) return { kind: 'svg' };
  const mode = getRenderedTextMode(path);
  return mode ? { kind: 'text', mode } : { kind: 'none' };
}
export function initialPreviewMode(preview: ContentPreview): 'raw' | 'rendered' {
  return preview.kind === 'image' || preview.kind === 'text' ? 'rendered' : 'raw';
}

/** Resolved once for a file render and shared by its controls and content. */
export interface FilePreviewDescriptor {
  builtIn: ContentPreview;
  renderer: import('./preview-renderer').PreviewRenderer | null;
  available: boolean;
  defaultMode: 'raw' | 'rendered';
}

export function resolveFilePreview(
  file: DiffFile,
  renderer: import('./preview-renderer').PreviewRenderer | null = null,
  builtIn = getContentPreview(file)
): FilePreviewDescriptor {
  const host = file.changeType === 'added' && renderer?.supports(file, builtIn) ? renderer : null;
  // Default discovery enforces added-file policy. An explicit discriminator from the legacy
  // component facade keeps its original meaning; only host renderer matching is added-only.
  return {
    builtIn,
    renderer: host,
    available: builtIn.kind !== 'none' || host !== null,
    defaultMode:
      builtIn.kind === 'none' && host ? (host.defaultMode ?? 'raw') : initialPreviewMode(builtIn),
  };
}
