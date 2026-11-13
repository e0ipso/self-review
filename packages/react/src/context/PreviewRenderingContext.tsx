import React, { createContext, useContext, type ReactNode } from 'react';
import type { PreviewRenderer } from '../services/preview-renderer';
import {
  defaultDiagramRenderService,
  type DiagramRenderService,
} from '../services/diagram-service';

// Preserve the original public imports as direct facades.
export type { PreviewRenderProps, PreviewRenderer } from '../services/preview-renderer';

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
