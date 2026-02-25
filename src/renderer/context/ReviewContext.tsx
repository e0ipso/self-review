import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  ReactNode,
} from 'react';
import type {
  Attachment,
  DiffFile,
  DiffHunk,
  DiffLoadPayload,
  DiffSource,
  FileReviewState,
  ReviewComment,
  ReviewState,
  LineRange,
  Suggestion,
} from '../../shared/types';
import { normalizeResumePath } from '../../shared/path-utils';
import { useReviewState } from '../hooks/useReviewState';
import { useConfig } from './ConfigContext';

export interface ReviewContextValue {
  files: FileReviewState[];
  diffFiles: DiffFile[];
  diffSource: DiffSource;
  setDiffFiles: (files: DiffFile[]) => void;
  addComment: (
    filePath: string,
    lineRange: LineRange | null,
    body: string,
    category: string,
    suggestion: Suggestion | null,
    attachments?: Attachment[]
  ) => void;
  editComment: (id: string, updates: Partial<ReviewComment>) => void;
  deleteComment: (id: string) => void;
  toggleViewed: (filePath: string) => void;
  getCommentsForFile: (filePath: string) => ReviewComment[];
  getCommentsForLine: (
    filePath: string,
    lineNumber: number,
    side: 'old' | 'new'
  ) => ReviewComment[];
  expandFileContext: (filePath: string, contextLines: number) => Promise<{ hunks: DiffHunk[]; totalLines: number } | null>;
  updateFileHunks: (filePath: string, hunks: DiffHunk[]) => void;
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

export function useReview() {
  const context = useContext(ReviewContext);
  if (!context) {
    throw new Error('useReview must be used within ReviewProvider');
  }
  return context;
}

interface ReviewProviderProps {
  children: ReactNode;
}

export function ReviewProvider({ children }: ReviewProviderProps) {
  const [allDiffFiles, setAllDiffFiles] = useState<DiffFile[]>([]);
  const [diffSource, setDiffSource] = useState<DiffSource>({ type: 'loading' });
  const { config } = useConfig();

  const reviewState = useReviewState();

  // Filter files based on showUntracked toggle
  const diffFiles = useMemo(() => {
    if (config.showUntracked) return allDiffFiles;
    return allDiffFiles.filter(file => !file.isUntracked);
  }, [allDiffFiles, config.showUntracked]);

  // Create refs for IPC listener closure
  const diffSourceRef = useRef(diffSource);
  const filesRef = useRef(reviewState.files);

  // Update refs when values change — use useLayoutEffect so refs are
  // current before any IPC handler (e.g. review:request) can read them.
  useLayoutEffect(() => {
    diffSourceRef.current = diffSource;
  }, [diffSource]);
  useLayoutEffect(() => {
    filesRef.current = reviewState.files;
  }, [reviewState.files]);

  // When allDiffFiles change, initialize FileReviewState for all files
  useEffect(() => {
    if (allDiffFiles.length > 0) {
      reviewState.setFiles(prev => {
        const prevByPath = new Map(prev.map(f => [f.path, f]));
        return allDiffFiles.map(file => {
          const path = file.newPath || file.oldPath;
          const existing = prevByPath.get(path);
          if (existing) {
            return { ...existing, changeType: file.changeType };
          }
          return {
            path,
            changeType: file.changeType,
            viewed: false,
            comments: [] as ReviewComment[],
          };
        });
      });
    }
  }, [allDiffFiles]);

  // Register IPC listeners ONCE and request initial data
  useEffect(() => {
    if (!window.electronAPI) return;

    // Set up listeners first
    window.electronAPI.onDiffLoad((payload: DiffLoadPayload) => {
      setAllDiffFiles(payload.files);
      setDiffSource(payload.source);

      // After diff is loaded, request resume data if available
      window.electronAPI.requestResumeData();
    });

    window.electronAPI.onResumeLoad(payload => {
      // Merge prior comments into existing state.
      // Build lookup maps for both exact and basename-fallback matching.
      reviewState.setFiles(prev => {
        // Map from exact path → FileReviewState index
        const exactIndex = new Map<string, number>(
          prev.map((f, i) => [f.path, i])
        );
        // Map from basename → array of indices (for collision detection)
        const basenameIndex = new Map<string, number[]>();
        prev.forEach((f, i) => {
          const base = normalizeResumePath(f.path);
          if (!basenameIndex.has(base)) basenameIndex.set(base, []);
          basenameIndex.get(base)!.push(i);
        });

        // Group comments by resolved file index
        const commentsByIndex = new Map<number, ReviewComment[]>();
        payload.comments.forEach(comment => {
          // Attempt exact match first
          let idx = exactIndex.get(comment.filePath);

          // Fallback: basename comparison when exact match fails
          if (idx === undefined) {
            const commentBase = normalizeResumePath(comment.filePath);
            const candidates = basenameIndex.get(commentBase) ?? [];
            // Only merge if unambiguous (exactly one candidate)
            if (candidates.length === 1) {
              idx = candidates[0];
            }
          }

          if (idx !== undefined) {
            if (!commentsByIndex.has(idx)) commentsByIndex.set(idx, []);
            commentsByIndex.get(idx)!.push(comment);
          }
        });

        return prev.map((file, i) => ({
          ...file,
          comments: commentsByIndex.get(i) ?? [],
        }));
      });
    });

    window.electronAPI.onRequestReview(() => {
      console.error('[renderer] Received review:request from main');
      const reviewData: ReviewState = {
        timestamp: new Date().toISOString(),
        source: diffSourceRef.current,
        files: filesRef.current,
      };
      console.error(
        '[renderer] Submitting review data:',
        JSON.stringify({
          timestamp: reviewData.timestamp,
          source: reviewData.source,
          fileCount: reviewData.files.length,
        })
      );
      window.electronAPI.submitReview(reviewData);
      console.error('[renderer] Review data submitted');
    });

    // Now request the data from main process
    window.electronAPI.requestDiffData();
  }, []); // Empty dependency array - register only once

  const expandFileContext = async (filePath: string, contextLines: number): Promise<{ hunks: DiffHunk[]; totalLines: number } | null> => {
    if (!window.electronAPI) return null;
    try {
      const response = await window.electronAPI.expandContext({ filePath, contextLines });
      if (!response) return null;
      return { hunks: response.hunks, totalLines: response.totalLines };
    } catch (error) {
      console.error('[ReviewContext] Failed to expand context:', error);
      return null;
    }
  };

  const updateFileHunks = (filePath: string, hunks: DiffHunk[]) => {
    setAllDiffFiles(prev =>
      prev.map(f => {
        const fPath = f.newPath || f.oldPath;
        if (fPath === filePath) {
          return { ...f, hunks };
        }
        return f;
      })
    );
  };

  return (
    <ReviewContext.Provider
      value={{
        files: reviewState.files,
        diffFiles,
        diffSource,
        setDiffFiles: setAllDiffFiles,
        addComment: reviewState.addComment,
        editComment: reviewState.updateComment,
        deleteComment: reviewState.deleteComment,
        toggleViewed: reviewState.toggleViewed,
        getCommentsForFile: reviewState.getCommentsForFile,
        getCommentsForLine: reviewState.getCommentsForLine,
        expandFileContext,
        updateFileHunks,
      }}
    >
      {children}
    </ReviewContext.Provider>
  );
}
