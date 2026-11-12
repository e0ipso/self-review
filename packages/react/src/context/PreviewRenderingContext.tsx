import React, { createContext, useContext, type ReactNode, type ComponentType } from 'react';
import type { DiffFile, LineRange } from '@self-review/types';
import type { ContentPreview } from '../components/DiffViewer/content-preview';
import {
  defaultDiagramRenderService,
  type DiagramRenderService,
} from '../components/DiffViewer/diagram-service';

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

const PreviewContext = createContext<PreviewRenderer | undefined>(undefined);
const DiagramContext = createContext<DiagramRenderService>(defaultDiagramRenderService);

export interface PreviewRenderingProviderProps {
  previewRenderer?: PreviewRenderer;
  diagramRenderer?: DiagramRenderService;
  children: ReactNode;
}

/** Optional host capabilities, separate from ReviewAdapter and review state. */
export function PreviewRenderingProvider({
  previewRenderer,
  diagramRenderer,
  children,
}: PreviewRenderingProviderProps) {
  const inheritedPreview = usePreviewRenderer();
  const inheritedDiagram = useDiagramRenderer();
  return (
    <PreviewContext.Provider value={previewRenderer ?? inheritedPreview}>
      <DiagramContext.Provider value={diagramRenderer ?? inheritedDiagram}>
        {children}
      </DiagramContext.Provider>
    </PreviewContext.Provider>
  );
}

export function usePreviewRenderer() {
  return useContext(PreviewContext);
}

export function useDiagramRenderer() {
  return useContext(DiagramContext);
}
