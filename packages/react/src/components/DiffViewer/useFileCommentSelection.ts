import { useCallback, useState, type RefObject } from 'react';
import type { DiffFile, LineRange } from '@self-review/types';
import { useDragSelection } from './useDragSelection';

/** Owns the file's comment targets; drafts remain owned by their composers. */
export function useFileCommentSelection(
  file: DiffFile,
  sectionRef: RefObject<HTMLElement | null>,
  effectiveViewMode: 'split' | 'unified'
) {
  const [commentRange, setCommentRange] = useState<LineRange | null>(null);
  const [showingFileComment, setShowingFileComment] = useState(false);
  const onCommentRange = useCallback((start: number, end: number, side: 'old' | 'new') => {
    setCommentRange({ start: Math.min(start, end), end: Math.max(start, end), side });
  }, []);
  const clearRange = useCallback(() => setCommentRange(null), []);
  const closeFileComment = useCallback(() => setShowingFileComment(false), []);
  const openFileComment = useCallback(() => setShowingFileComment(true), []);
  const { dragState, handleDragStart } = useDragSelection({
    sectionRef,
    effectiveViewMode,
    file,
    filePath: file.newPath || file.oldPath,
    onCommentRange,
  });
  return {
    lineComments: { commentRange, onCancelComment: clearRange, onCommentSaved: clearRange },
    rawSelection: { dragState, onDragStart: handleDragStart },
    onCommentRange,
    fileComment: { showingFileComment, openFileComment, closeFileComment },
  };
}
