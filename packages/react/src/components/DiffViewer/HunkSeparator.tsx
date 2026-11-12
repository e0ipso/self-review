import React from 'react';
import type { DiffHunk } from '@self-review/types';
import HunkHeader from './HunkHeader';
import ExpandContextBar, { type ExpandContextBarProps } from './ExpandContextBar';

interface HunkSeparatorProps {
  hunks: DiffHunk[];
  /** The index after the last hunk denotes the trailing gap. */
  hunkIndex: number;
  isExpandable?: boolean;
  onExpandContext?: ExpandContextBarProps['onExpand'];
  expandLoading?: boolean;
  totalLines?: number | null;
}

function expansionGap(hunks: DiffHunk[], index: number, totalLines?: number | null) {
  if (hunks.length === 0) return null;
  if (index === hunks.length) {
    const last = hunks[index - 1];
    return {
      position: 'bottom' as const,
      hunkIndex: index - 1,
      gapSize: totalLines == null ? undefined : totalLines - (last.newStart + last.newLines - 1),
    };
  }
  const current = hunks[index];
  return {
    position: index === 0 ? ('top' as const) : ('between' as const),
    hunkIndex: index,
    gapSize:
      index === 0
        ? Math.max(current.oldStart, current.newStart) - 1
        : current.newStart - (hunks[index - 1].newStart + hunks[index - 1].newLines),
  };
}

/** Both raw layouts use the same gap arithmetic, expansion controls and hunk heading. */
export function HunkSeparator({
  hunks,
  hunkIndex,
  isExpandable,
  onExpandContext,
  expandLoading,
  totalLines,
}: HunkSeparatorProps) {
  const gap = isExpandable && onExpandContext ? expansionGap(hunks, hunkIndex, totalLines) : null;
  return (
    <>
      {gap && onExpandContext && (
        <ExpandContextBar {...gap} onExpand={onExpandContext} loading={expandLoading} />
      )}
      {hunks[hunkIndex] && <HunkHeader header={hunks[hunkIndex].header} />}
    </>
  );
}
