import type { ReactNode, ComponentType } from 'react';
import type { DiffFile, LineRange } from '@self-review/types';
import type { ContentPreview } from './content-preview';

export interface PreviewRenderProps {
  file: DiffFile;
  filePath: string;
  preview: ContentPreview;
  commentRange: LineRange | null;
  onCommentRange: (start: number, end: number, side: 'old' | 'new') => void;
  onCancelComment: () => void;
  onCommentSaved: () => void;
  /** Existing passive built-in preview, or null for a host-only format. */
  children: ReactNode;
}

/** Trusted React composition, scoped to this provider. Keep reviewed content passive. */
export interface PreviewRenderer {
  /** Called for added files only. Return false to preserve built-in dispatch. */
  supports: (file: DiffFile, builtIn: ContentPreview) => boolean;
  component: ComponentType<PreviewRenderProps>;
  /** Host-only formats default to raw; built-in defaults remain unchanged. */
  defaultMode?: 'raw' | 'rendered';
}
