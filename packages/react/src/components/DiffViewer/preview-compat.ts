/**
 * Compatibility for DiffContentArea's 2.0.4 props. Remove when callers no longer supply the
 * independent preview flags and the next breaking release can require `preview` instead.
 */
import type { RenderedTextMode } from '../../utils/file-type-utils';
import type { DiffContentAreaProps, PreviewContentAreaProps } from './DiffContentArea';
import type { ContentPreview } from '../../services/content-preview';

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

/** Normalize legacy callers once; preview-only internal callers already satisfy the dispatcher. */
export function normalizePreviewProps(
  props: DiffContentAreaProps | PreviewContentAreaProps
): PreviewContentAreaProps {
  if (!('showImagePreview' in props)) return props;
  const {
    preview,
    showImagePreview,
    showSvgPreview,
    renderedTextMode,
    isEligibleForRenderedView,
    ...shared
  } = props;
  return {
    ...shared,
    preview:
      preview ??
      previewFromFlags({
        showImagePreview,
        showSvgPreview,
        renderedTextMode,
        isEligibleForRenderedView,
      }),
  };
}
