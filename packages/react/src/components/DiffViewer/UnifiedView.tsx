import { useLocalization } from '../../localization/LocalizationContext';
import React, { useMemo } from 'react';
import type { DiffFile } from '@self-review/types';
import { RawDiffRow, useRawDragStart } from './RawDiffRow';
import { useRawDiffAnnotations } from './useRawDiffAnnotations';
import { HunkSeparator } from './HunkSeparator';
import { useAppearance } from '../../context/ConfigContext';
import { planHighlighting } from './highlight-budget';
import { getLanguageFromPath } from '../../utils/file-type-utils';
import { InlineCommentSlot } from './InlineCommentSlot';

export interface UnifiedViewProps {
  file: DiffFile;
  commentRange: { start: number; end: number; side: 'old' | 'new' } | null;
  dragState: {
    startLine: number;
    currentLine: number;
    side: 'old' | 'new';
  } | null;
  onDragStart: (lineNumber: number, side: 'old' | 'new', keyboard?: boolean) => void;
  onCancelComment: () => void;
  onCommentSaved: () => void;
  onExpandContext?: (
    direction: 'up' | 'down' | 'all',
    hunkIndex: number,
    position: 'top' | 'between' | 'bottom'
  ) => void;
  isExpandable?: boolean;
  expandLoading?: boolean;
  totalLines?: number | null;
}

export default function UnifiedView({
  file,
  commentRange,
  dragState,
  onDragStart,
  onCancelComment,
  onCommentSaved,
  onExpandContext,
  isExpandable,
  expandLoading,
  totalLines,
}: UnifiedViewProps) {
  const { t } = useLocalization();
  const startDrag = useRawDragStart(onDragStart);
  const { commentIndex, originalCode, rowOffsets, feedbackAt, getOriginalCodeForComment } =
    useRawDiffAnnotations(file, commentRange);
  const highlighting = useMemo(() => planHighlighting(file), [file]);
  const config = useAppearance();
  const language = getLanguageFromPath(file.newPath || file.oldPath);

  const filePath = file.newPath || file.oldPath;

  return (
    <div className='font-mono text-[13px] leading-[22px] unified-view'>
      {highlighting.limited && (
        <p role='status' className='px-3 py-1 text-xs font-sans text-muted-foreground'>
          {t('Highlighting is limited for this file. All source lines remain available.')}
        </p>
      )}
      {file.hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex}>
          <HunkSeparator
            hunks={file.hunks}
            hunkIndex={hunkIndex}
            isExpandable={isExpandable}
            onExpandContext={onExpandContext}
            expandLoading={expandLoading}
            totalLines={totalLines}
          />
          {hunk.lines.map((line, lineIndex) => {
            const rowIndex = rowOffsets[hunkIndex] + lineIndex;
            const lineNumber = line.type === 'deletion' ? line.oldLineNumber : line.newLineNumber;
            const side: 'old' | 'new' = line.type === 'deletion' ? 'old' : 'new';
            const { comments: commentsToRender, showInput: showCommentInputHere } = feedbackAt(
              line.oldLineNumber,
              line.newLineNumber,
              'new'
            );
            const hasComment =
              commentIndex.covers(lineNumber, side) ||
              (line.type === 'context' && commentIndex.covers(line.oldLineNumber, 'old'));
            // Comment range highlight: real line numbers + side
            const selectedNumber =
              commentRange?.side === 'old' ? line.oldLineNumber : line.newLineNumber;
            const isInCommentRange =
              commentRange &&
              selectedNumber !== null &&
              selectedNumber >= commentRange.start &&
              selectedNumber <= commentRange.end;
            // Drag highlight: row indices (side-agnostic for cross-type drag)
            const isInDragRange =
              dragState !== null &&
              rowIndex >= Math.min(dragState.startLine, dragState.currentLine) &&
              rowIndex <= Math.max(dragState.startLine, dragState.currentLine);
            const isSelected = !!(isInCommentRange || isInDragRange);

            return (
              <React.Fragment key={`${hunkIndex}-${lineIndex}`}>
                <RawDiffRow
                  layout='unified'
                  filePath={filePath}
                  oldLineNumber={line.oldLineNumber}
                  newLineNumber={line.newLineNumber}
                  lineType={line.type}
                  content={line.content}
                  language={highlighting.lines.has(line) ? language : 'plaintext'}
                  wordWrap={config.wordWrap}
                  isSelected={isSelected}
                  hasComment={hasComment}
                  rowIndex={rowIndex}
                  onDragStart={startDrag}
                />

                {(commentsToRender.length > 0 || showCommentInputHere) && (
                  <InlineCommentSlot
                    commentsToRender={commentsToRender}
                    showCommentInput={!!showCommentInputHere}
                    commentRange={commentRange}
                    filePath={file.newPath || file.oldPath}
                    originalCode={originalCode}
                    onCancel={onCancelComment}
                    onSaved={onCommentSaved}
                    indentClass='ms-[100px]'
                    getOriginalCodeForComment={getOriginalCodeForComment}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      ))}
      <HunkSeparator
        hunks={file.hunks}
        hunkIndex={file.hunks.length}
        isExpandable={isExpandable}
        onExpandContext={onExpandContext}
        expandLoading={expandLoading}
        totalLines={totalLines}
      />
    </div>
  );
}
