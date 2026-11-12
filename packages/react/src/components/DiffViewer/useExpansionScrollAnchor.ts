import { useLayoutEffect, useMemo, useRef } from 'react';
import type { DiffHunk } from '@self-review/types';
import { expansionAnchor, type ExpansionDirection, type ExpansionPosition } from './expansion-plan';

/** Capture before a read, then compensate once after its hunk commit. */
export function useExpansionScrollAnchor(
  sectionRef: React.RefObject<HTMLElement | null>,
  hunks: DiffHunk[],
  owner: object
) {
  const pending = useRef<{
    owner: object;
    lineNumber: number;
    side: 'old' | 'new';
    offset: number;
    scrollTop: number;
  } | null>(null);
  useLayoutEffect(() => {
    const anchor = pending.current;
    if (!anchor) return;
    pending.current = null;
    if (anchor.owner !== owner) return;
    const section = sectionRef.current;
    const container = section?.closest<HTMLElement>('[data-scroll-container="diff"]');
    const element = section?.querySelector<HTMLElement>(
      `[data-line-number="${anchor.lineNumber}"][data-line-side="${anchor.side}"]`
    );
    if (!element || !container) return;
    const drift =
      element.getBoundingClientRect().top - container.getBoundingClientRect().top - anchor.offset;
    if (Math.abs(drift) > 1) container.scrollTop = anchor.scrollTop + drift;
  }, [hunks, owner, sectionRef]);
  return useMemo(
    () => ({
      clear: () => {
        pending.current = null;
      },
      capture(
        currentHunks: DiffHunk[],
        direction: ExpansionDirection,
        hunkIndex: number,
        position: ExpansionPosition
      ) {
        pending.current = null;
        const anchor = expansionAnchor(currentHunks, direction, hunkIndex, position);
        const section = sectionRef.current;
        const container = section?.closest<HTMLElement>('[data-scroll-container="diff"]');
        if (!anchor || !container || !section) return;
        const element = section.querySelector<HTMLElement>(
          `[data-line-number="${anchor.lineNumber}"][data-line-side="${anchor.side}"]`
        );
        if (element)
          pending.current = {
            ...anchor,
            owner,
            offset: element.getBoundingClientRect().top - container.getBoundingClientRect().top,
            scrollTop: container.scrollTop,
          };
      },
    }),
    [owner, sectionRef]
  );
}
