import React, { useCallback } from 'react';
import { useOptionalSnapshotKey } from '../../context/ReviewContext';
import { useAdapter } from '../../context/ReviewAdapterContext';
import { usePreviewRenderer } from '../../context/PreviewRenderingContext';
import type { PreviewRenderProps } from '../../services/preview-renderer';
import RenderedMarkdownView from './RenderedMarkdownView';
import RenderedImageView from './RenderedImageView';
import RenderedSvgView from './RenderedSvgView';

interface FilePreviewProps extends PreviewRenderProps {
  mode: 'raw' | 'rendered';
}

/** Chooses host or passive built-in preview, with raw content supplied as its fallback. */
export function FilePreview({
  file,
  filePath,
  preview,
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
  const hostPreview = file.changeType === 'added' && !!renderer?.supports(file, preview);
  const renderPreview =
    mode === 'rendered' &&
    (hostPreview ||
      (preview.kind !== 'none' &&
        (preview.kind !== 'text' || (!file.isBinary && file.hunks.length > 0))));
  const builtInPreview = () => {
    switch (preview.kind) {
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
            contentMode={preview.mode}
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
    if (hostPreview && renderer) {
      const HostPreview = renderer.component;
      return (
        <HostPreview
          file={file}
          filePath={filePath}
          preview={preview}
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
