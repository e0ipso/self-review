import { useEffect, useRef, useState } from 'react';
import { useReview } from '../../packages/react/src/context/ReviewContext';

/** Sticky for this mounted review, including removal of its final resumed comment or viewed flag. */
export function useUnsavedReviewWork(): boolean {
  const { files } = useReview();
  const previous = useRef(files);
  const [changed, setChanged] = useState(false);
  const hasWork = files.some(file => file.viewed || file.comments.length > 0);
  useEffect(() => {
    const before = previous.current;
    previous.current = files;
    if (changed) return;
    const byPath = new Map(files.map(file => [file.path, file]));
    if (
      hasWork ||
      before.some(file => {
        const next = byPath.get(file.path);
        return next && (next.viewed !== file.viewed || next.comments !== file.comments);
      })
    )
      setChanged(true);
  }, [files, hasWork, changed]);
  return changed || hasWork;
}
