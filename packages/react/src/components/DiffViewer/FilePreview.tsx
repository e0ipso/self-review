import React, { useCallback } from 'react';
import { useOptionalSnapshotKey } from '../../context/ReviewContext';
import { useAdapter } from '../../context/ReviewAdapterContext';
import { usePreviewRenderer } from '../../context/PreviewRenderingContext';
import { resolveFilePreview, type FilePreviewDescriptor } from '../../services/content-preview';
import type { PreviewRenderProps } from '../../services/preview-renderer';
import RenderedMarkdownView from './RenderedMarkdownView';
import RenderedImageView from './RenderedImageView';
import RenderedSvgView from './RenderedSvgView';

interface FilePreviewProps extends PreviewRenderProps {
  mode: 'raw' | 'rendered';
  descriptor?: FilePreviewDescriptor;
}

/** Chooses host or passive built-in preview, with raw content supplied as its fallback. */
export function FilePreview({
  file,
  filePath,
  preview,
  descriptor,
  mode,
  commentRange,
  onCommentRange,
  onCancelComment,
  onCommentSaved,
  children,
}: FilePreviewProps) {
  const adapter = useAdapter();
  const renderer = usePreviewRenderer();
  const snapshotKey = useOptionalSnapshotKey();
  const handleGutterMouseDown = useCallback(
    (start: number, end: number) => onCommentRange(start, end, 'new'),
    [onCommentRange]
  );
  const resolved = descriptor ?? resolveFilePreview(file, renderer, preview);
  const builtIn = resolved.builtIn;
  const host = resolved.renderer;
  const renderPreview =
    mode === 'rendered' &&
    (host ||
      (builtIn.kind !== 'none' &&
        (builtIn.kind !== 'text' || (!file.isBinary && file.hunks.length > 0))));
  const builtInPreview = () => {
    switch (builtIn.kind) {
      case 'image':
        return (
          <RenderedImageView
            key={snapshotKey}
            filePath={filePath}
            onLoadImage={adapter?.loadImage}
          />
        );
      case 'svg':
        return <RenderedSvgView file={file} />;
      case 'text':
        if (file.isBinary || file.hunks.length === 0) return null;
        return (
          <RenderedMarkdownView
            file={file}
            contentMode={builtIn.mode}
            commentRange={commentRange}
            onCancelComment={onCancelComment}
            onCommentSaved={onCommentSaved}
            onGutterMouseDown={handleGutterMouseDown}
          />
        );
    }
    return null;
  };
  if (renderPreview) {
    if (host) {
      const HostPreview = host.component;
      return (
        <HostPreview
          file={file}
          filePath={filePath}
          preview={builtIn}
          commentRange={commentRange}
          onCommentRange={onCommentRange}
          onCancelComment={onCancelComment}
          onCommentSaved={onCommentSaved}
        >
          {builtInPreview()}
        </HostPreview>
      );
    }
    return builtInPreview();
  }

  return children;
}
