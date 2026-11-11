/**
 * Compatibility for DiffContentArea's 2.0.4 props. Remove when callers no longer supply the
 * independent preview flags and the next breaking release can require `preview` instead.
 */
import type { RenderedTextMode } from '../../utils/file-type-utils';
import type { ContentPreview } from './content-preview';

export function previewFromFlags({
  showImagePreview,
  showSvgPreview,
  isEligibleForRenderedView,
  renderedTextMode,
}: {
  showImagePreview: boolean;
  showSvgPreview: boolean;
  isEligibleForRenderedView: boolean;
  renderedTextMode: RenderedTextMode | null;
}): ContentPreview {
  if (showImagePreview) return { kind: 'image' };
  if (showSvgPreview) return { kind: 'svg' };
  if (isEligibleForRenderedView && renderedTextMode)
    return { kind: 'text', mode: renderedTextMode };
  return { kind: 'none' };
}
