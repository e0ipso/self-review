// @self-review/react — Embeddable React components for code review

// Main entry components
export { ReviewPanel } from './ReviewPanel';
export type { ReviewPanelProps, ReviewPanelHandle } from './ReviewPanel';
export { SingleFileReview } from './SingleFileReview';
export type { SingleFileReviewProps } from './SingleFileReview';

// Adapter interface
export type { ReviewAdapter, ConfigAdapter } from './adapter';

// Re-export types consumers commonly need
export type {
  DiffFile,
  DiffHunk,
  DiffLine,
  DiffLineType,
  ChangeType,
  DiffSource,
  DiffLoadPayload,
  ReviewComment,
  ReviewState,
  FileReviewState,
  Suggestion,
  LineRange,
  Attachment,
  AppConfig,
  CategoryDef,
  OutputPathInfo,
  ExpandContextRequest,
  ExpandContextResponse,
  ResumeLoadPayload,
  PayloadStats,
} from '@self-review/core';

// Context providers (for advanced/custom composition)
export { ReviewProvider, useReview } from './context/ReviewContext';
export type { ReviewContextValue, ReviewProviderProps } from './context/ReviewContext';
export { ConfigProvider, useConfig, defaultConfig } from './context/ConfigContext';
export type { ConfigContextValue, ConfigProviderProps } from './context/ConfigContext';
export { DiffNavigationProvider, useDiffNavigationContext } from './context/DiffNavigationContext';
export { ReviewAdapterProvider, useAdapter } from './context/ReviewAdapterContext';

// Individual components (for advanced/custom composition)
export { default as DiffViewer } from './components/DiffViewer/DiffViewer';
export { default as FileSection } from './components/DiffViewer/FileSection';
export { default as FileTree } from './components/FileTree';
export { default as Layout } from './components/Layout';
export { default as Toolbar } from './components/Toolbar';

// Hooks
export { useReviewState } from './hooks/useReviewState';
export { useDiffNavigation } from './hooks/useDiffNavigation';
