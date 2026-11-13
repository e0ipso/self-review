import { useCallback, useEffect, useRef } from 'react';
import { useReviewExpansion } from '../../context/ReviewDisplayContext';

/** One expansion owner for header actions and viewed changes from either panel. */
export function useFileSectionExpansion(
  filePath: string,
  isViewed: boolean,
  controlledExpanded?: boolean,
  onToggleExpanded?: (filePath: string) => void
) {
  const { expanded: expansion, setExpanded } = useReviewExpansion();
  const expanded = controlledExpanded ?? expansion.get(filePath) ?? false;
  const changeExpanded = useCallback(
    (next: boolean) => {
      if (expanded === next) return;
      if (onToggleExpanded) onToggleExpanded(filePath);
      else setExpanded(filePath, next);
    },
    [expanded, onToggleExpanded, filePath, setExpanded]
  );
  const previouslyViewed = useRef(false);
  useEffect(() => {
    if (previouslyViewed.current !== isViewed) changeExpanded(!isViewed);
    previouslyViewed.current = isViewed;
  }, [isViewed, changeExpanded]);
  return { expanded, changeExpanded };
}
