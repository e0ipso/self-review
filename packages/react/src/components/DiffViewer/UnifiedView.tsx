import { useLocalization } from '../../localization/LocalizationContext';
import React, { useMemo } from 'react';
import type { DiffFile } from '@self-review/types';
import { CommentGutterButton } from './CommentGutterButton';
import { useFileCommentIndex } from './useFileCommentIndex';
import { useAppearance } from '../../context/ConfigContext';
import HunkHeader from './HunkHeader';
import SyntaxLine from './SyntaxLine';
import { planHighlighting } from './highlight-budget';
import { getLanguageFromPath } from '../../utils/file-type-utils';
import { extractOriginalCode } from './diff-utils';
import { InlineCommentSlot } from './InlineCommentSlot';
import ExpandContextBar from './ExpandContextBar';
import { getLineBg, getGutterBg } from '../../utils/diff-styles';

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
  const commentIndex = useFileCommentIndex(file);
  const highlighting = useMemo(() => planHighlighting(file), [file]);
  const config = useAppearance();
  const language = getLanguageFromPath(file.newPath || file.oldPath);

  // Pre-compute row offsets per hunk for sequential row indexing
  const hunkRowOffsets = useMemo(() => {
    const offsets: number[] = [];
    let offset = 0;
    for (const hunk of file.hunks) {
      offsets.push(offset);
      offset += hunk.lines.length;
    }
    return offsets;
  }, [file]);

  const filePath = file.newPath || file.oldPath;

  const computeGapBefore = (hunkIndex: number): number | undefined => {
    if (!isExpandable) return undefined;
    if (hunkIndex === 0) {
      const start = Math.max(file.hunks[0].oldStart, file.hunks[0].newStart);
      return start > 1 ? start - 1 : 0;
    }
    const prev = file.hunks[hunkIndex - 1];
    const curr = file.hunks[hunkIndex];
    return curr.newStart - (prev.newStart + prev.newLines);
  };

  const originalCode = useMemo(
    () => (commentRange ? extractOriginalCode(file, commentRange) : undefined),
    [file, commentRange]
  );

  return (
    <div className='font-mono text-[13px] leading-[22px] unified-view'>
      {highlighting.limited && (
        <p role='status' className='px-3 py-1 text-xs font-sans text-muted-foreground'>
          {t('Highlighting is limited for this file. All source lines remain available.')}
        </p>
      )}
      {file.hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex}>
          {isExpandable &&
            onExpandContext &&
            hunkIndex === 0 &&
            (file.hunks[0].oldStart > 1 || file.hunks[0].newStart > 1) && (
              <ExpandContextBar
                position='top'
                hunkIndex={0}
                gapSize={computeGapBefore(0)}
                onExpand={onExpandContext}
                loading={expandLoading}
              />
            )}
          {isExpandable && onExpandContext && hunkIndex > 0 && (
            <ExpandContextBar
              position='between'
              hunkIndex={hunkIndex}
              gapSize={computeGapBefore(hunkIndex)}
              onExpand={onExpandContext}
              loading={expandLoading}
            />
          )}
          <HunkHeader header={hunk.header} />
          {hunk.lines.map((line, lineIndex) => {
            const rowIndex = hunkRowOffsets[hunkIndex] + lineIndex;
            const lineNumber = line.type === 'deletion' ? line.oldLineNumber : line.newLineNumber;
            const side: 'old' | 'new' = line.type === 'deletion' ? 'old' : 'new';
            const commentsToRender = [
              ...commentIndex.endingAt(line.newLineNumber, 'new'),
              ...commentIndex.endingAt(line.oldLineNumber, 'old'),
            ];
            const hasComment =
              commentIndex.covers(lineNumber, side) ||
              (line.type === 'context' && commentIndex.covers(line.oldLineNumber, 'old'));
            const showCommentInputHere =
              commentRange &&
              (commentRange.side === 'old' ? line.oldLineNumber : line.newLineNumber) ===
                commentRange.end;

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
                <div
                  className={`flex ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : getLineBg(line)} ${hasComment ? 'shadow-[inset_4px_0_0_0_#d97706] dark:shadow-[inset_4px_0_0_0_#fcd34d]' : ''} ${line.type === 'addition' ? 'diff-line-addition' : ''} ${line.type === 'deletion' ? 'diff-line-deletion' : ''}`}
                  style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 26px' }}
                  data-line-number={lineNumber || undefined}
                  data-line-side={side}
                  data-line-type={line.type}
                  data-row-index={rowIndex}
                >
                  {/* Old line number */}
                  <div
                    className={`w-10 flex-shrink-0 text-end pe-2 text-[11px] leading-[22px] text-muted-foreground/70 select-none ${getGutterBg(line)} group/gutter-old relative`}
                    data-testid={
                      line.oldLineNumber ? `old-line-${filePath}-${line.oldLineNumber}` : undefined
                    }
                  >
                    {line.oldLineNumber && (
                      <CommentGutterButton
                        className='absolute start-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/gutter-old:opacity-100'
                        label={t('Comment on old line {line}', { line: line.oldLineNumber! })}
                        onStartDrag={() => onDragStart(rowIndex, 'old')}
                        onActivate={() => onDragStart(rowIndex, 'old', true)}
                        data-testid={`comment-icon-old-${line.oldLineNumber}`}
                      />
                    )}
                    <span className='pointer-events-none'>{line.oldLineNumber || ''}</span>
                  </div>
                  {/* New line number */}
                  <div
                    className={`w-10 flex-shrink-0 text-end pe-2 text-[11px] leading-[22px] text-muted-foreground/70 select-none ${getGutterBg(line)} group/gutter-new relative`}
                    data-testid={
                      line.newLineNumber ? `new-line-${filePath}-${line.newLineNumber}` : undefined
                    }
                  >
                    {line.newLineNumber && (
                      <CommentGutterButton
                        className='absolute start-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/gutter-new:opacity-100'
                        label={t('Comment on new line {line}', { line: line.newLineNumber! })}
                        onStartDrag={() => onDragStart(rowIndex, 'new')}
                        onActivate={() => onDragStart(rowIndex, 'new', true)}
                        data-testid={`comment-icon-new-${line.newLineNumber}`}
                      />
                    )}
                    <span className='pointer-events-none'>{line.newLineNumber || ''}</span>
                  </div>
                  {/* Code content */}
                  <div
                    className={`flex-1 px-3 py-0.5 leading-[22px]${config.wordWrap ? '' : ' [overflow-x:overlay]'}`}
                  >
                    <SyntaxLine
                      content={line.content}
                      language={highlighting.lines.has(line) ? language : 'plaintext'}
                      lineType={line.type}
                      wordWrap={config.wordWrap}
                    />
                  </div>
                </div>

                <InlineCommentSlot
                  commentsToRender={commentsToRender}
                  showCommentInput={!!showCommentInputHere}
                  commentRange={commentRange}
                  filePath={file.newPath || file.oldPath}
                  originalCode={originalCode}
                  onCancel={onCancelComment}
                  onSaved={onCommentSaved}
                  indentClass='ms-[100px]'
                  getOriginalCodeForComment={comment =>
                    comment.lineRange ? extractOriginalCode(file, comment.lineRange) : undefined
                  }
                />
              </React.Fragment>
            );
          })}
        </div>
      ))}
      {isExpandable &&
        onExpandContext &&
        (() => {
          const lastIdx = file.hunks.length - 1;
          const lastHunk = file.hunks[lastIdx];
          const lastNewLine = lastHunk.newStart + lastHunk.newLines - 1;
          const bottomGap = totalLines != null ? totalLines - lastNewLine : undefined;
          if (bottomGap !== undefined && bottomGap <= 0) return null;
          return (
            <ExpandContextBar
              position='bottom'
              hunkIndex={lastIdx}
              gapSize={bottomGap}
              onExpand={onExpandContext}
              loading={expandLoading}
            />
          );
        })()}
    </div>
  );
}
