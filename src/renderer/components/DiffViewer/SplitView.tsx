import React from 'react';
import { MessageSquarePlus } from 'lucide-react';
import type { DiffFile, DiffLine } from '../../../shared/types';
import { useReview } from '../../context/ReviewContext';
import { useConfig } from '../../context/ConfigContext';
import HunkHeader from './HunkHeader';
import SyntaxLine, { getLanguageFromPath } from './SyntaxLine';
import CommentInput from '../Comments/CommentInput';
import CommentDisplay from '../Comments/CommentDisplay';
import { extractOriginalCode } from './diff-utils';
import ExpandContextBar from './ExpandContextBar';
import { getLineBg, getGutterBg } from '../../utils/diff-styles';
import EmptyLinePane from './EmptyLinePane';

export interface SplitViewProps {
  file: DiffFile;
  commentRange: { start: number; end: number; side: 'old' | 'new' } | null;
  dragState: {
    startLine: number;
    currentLine: number;
    side: 'old' | 'new';
  } | null;
  onDragStart: (lineNumber: number, side: 'old' | 'new') => void;
  onCancelComment: () => void;
  onCommentSaved: () => void;
  onExpandContext?: (direction: 'up' | 'down' | 'all', hunkIndex: number, position: 'top' | 'between' | 'bottom') => void;
  isExpandable?: boolean;
  expandLoading?: boolean;
  totalLines?: number | null;
}

interface SplitLineRow {
  oldLine: DiffLine | null;
  newLine: DiffLine | null;
}

export default function SplitView({
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
}: SplitViewProps) {
  const { getCommentsForLine } = useReview();
  const { config } = useConfig();
  const filePath = file.newPath || file.oldPath;
  const language = getLanguageFromPath(filePath);

  const isLineSelected = (lineNumber: number, side: 'old' | 'new') => {
    if (commentRange && commentRange.side === side) {
      if (lineNumber >= commentRange.start && lineNumber <= commentRange.end)
        return true;
    }
    if (dragState && dragState.side === side) {
      const min = Math.min(dragState.startLine, dragState.currentLine);
      const max = Math.max(dragState.startLine, dragState.currentLine);
      if (lineNumber >= min && lineNumber <= max) return true;
    }
    return false;
  };

  const buildSplitRows = (lines: DiffLine[]): SplitLineRow[] => {
    const rows: SplitLineRow[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.type === 'context') {
        rows.push({ oldLine: line, newLine: line });
        i++;
      } else if (line.type === 'deletion') {
        // Collect consecutive deletions
        const deletions: DiffLine[] = [];
        while (i < lines.length && lines[i].type === 'deletion') {
          deletions.push(lines[i]);
          i++;
        }
        // Collect consecutive additions that follow
        const additions: DiffLine[] = [];
        while (i < lines.length && lines[i].type === 'addition') {
          additions.push(lines[i]);
          i++;
        }
        // Zip deletions and additions into paired rows
        const maxLen = Math.max(deletions.length, additions.length);
        for (let j = 0; j < maxLen; j++) {
          rows.push({
            oldLine: j < deletions.length ? deletions[j] : null,
            newLine: j < additions.length ? additions[j] : null,
          });
        }
      } else if (line.type === 'addition') {
        rows.push({ oldLine: null, newLine: line });
        i++;
      } else {
        i++;
      }
    }

    return rows;
  };

  // Extract original code for the selected line range (for suggestions)
  const getOriginalCode = (): string | undefined => {
    if (!commentRange) return undefined;
    return extractOriginalCode(file, commentRange);
  };

  const renderLineCell = (
    line: DiffLine | null,
    side: 'old' | 'new',
    hasComment = false
  ) => {
    if (!line) {
      return <EmptyLinePane />;
    }

    const lineNumber = side === 'old' ? line.oldLineNumber : line.newLineNumber;
    const isSelected = lineNumber ? isLineSelected(lineNumber, side) : false;

    const lineTestId = lineNumber
      ? `${side === 'old' ? 'old' : 'new'}-line-${filePath}-${lineNumber}`
      : undefined;

    return (
      <div
        className={`split-half w-1/2 flex ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : getLineBg(line)} ${hasComment ? 'shadow-[inset_4px_0_0_0_#d97706] dark:shadow-[inset_4px_0_0_0_#fcd34d]' : ''} ${line.type === 'addition' ? 'diff-line-addition' : ''} ${line.type === 'deletion' ? 'diff-line-deletion' : ''}`}
        data-line-number={lineNumber || undefined}
        data-line-side={side}
        data-line-type={line.type}
      >
        {/* Line number gutter */}
        <div
          className={`w-10 flex-shrink-0 text-right pr-2 text-[11px] leading-[22px] text-muted-foreground/70 select-none ${getGutterBg(line)} group/gutter relative`}
          data-testid={lineTestId}
        >
          {lineNumber && (
            <button
              className='absolute left-0 top-1/2 -translate-y-1/2 h-[22px] flex items-center justify-center w-7 opacity-0 group-hover/gutter:opacity-100 transition-all cursor-pointer text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 dark:hover:text-white rounded-sm'
              onMouseDown={e => {
                e.preventDefault();
                e.stopPropagation();
                onDragStart(lineNumber, side);
              }}
              data-testid={`comment-icon-${side}-${lineNumber}`}
            >
              <MessageSquarePlus className='h-4 w-4' />
            </button>
          )}
          <span className='pointer-events-none'>{lineNumber || ''}</span>
        </div>
        {/* Code content */}
        <div className={`flex-1 px-3 py-0.5 leading-[22px]${config.wordWrap ? '' : ' [overflow-x:overlay]'}`}>
          <SyntaxLine
            content={line.content}
            language={language}
            lineType={line.type}
            wordWrap={config.wordWrap}
          />
        </div>
      </div>
    );
  };

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

  return (
    <div className='font-mono text-[13px] leading-[22px] split-view'>
      {file.hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex}>
          {isExpandable && onExpandContext && hunkIndex === 0 && (file.hunks[0].oldStart > 1 || file.hunks[0].newStart > 1) && (
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
          {buildSplitRows(hunk.lines).map((row, rowIndex) => {
            const oldLineNumber = row.oldLine?.oldLineNumber;
            const newLineNumber = row.newLine?.newLineNumber;
            const oldComments = oldLineNumber
              ? getCommentsForLine(
                  file.newPath || file.oldPath,
                  oldLineNumber,
                  'old'
                )
              : [];
            const newComments = newLineNumber
              ? getCommentsForLine(
                  file.newPath || file.oldPath,
                  newLineNumber,
                  'new'
                )
              : [];
            const oldCommentsToRender = oldComments.filter(
              c => c.lineRange!.end === oldLineNumber
            );
            const newCommentsToRender = newComments.filter(
              c => c.lineRange!.end === newLineNumber
            );
            const hasCommentsToRender =
              oldCommentsToRender.length > 0 || newCommentsToRender.length > 0;
            const showCommentInputHere =
              commentRange &&
              ((commentRange.side === 'old' &&
                oldLineNumber === commentRange.end) ||
                (commentRange.side === 'new' &&
                  newLineNumber === commentRange.end));

            return (
              <React.Fragment key={`${hunkIndex}-${rowIndex}`}>
                <div className='flex'>
                  {/* Old side (left) */}
                  {row.oldLine ? (
                    renderLineCell(row.oldLine, 'old', oldComments.length > 0)
                  ) : (
                    <EmptyLinePane />
                  )}
                  {/* New side (right) */}
                  {row.newLine ? (
                    renderLineCell(row.newLine, 'new', newComments.length > 0)
                  ) : (
                    <EmptyLinePane />
                  )}
                </div>

                {/* Comments spanning full width (rendered at last line of range) */}
                {hasCommentsToRender && (
                  <div className='border-y border-border/50 bg-muted/20 px-4 py-3 space-y-2'>
                    {oldCommentsToRender.map(comment => (
                      <CommentDisplay
                        key={comment.id}
                        comment={comment}
                        originalCode={comment.lineRange ? extractOriginalCode(file, comment.lineRange) : undefined}
                      />
                    ))}
                    {newCommentsToRender.map(comment => (
                      <CommentDisplay
                        key={comment.id}
                        comment={comment}
                        originalCode={comment.lineRange ? extractOriginalCode(file, comment.lineRange) : undefined}
                      />
                    ))}
                  </div>
                )}

                {/* Comment input spanning full width */}
                {showCommentInputHere && (
                  <div className='border-y border-border/50 bg-muted/20 px-4 py-3'>
                    <CommentInput
                      filePath={file.newPath || file.oldPath}
                      lineRange={{
                        side: commentRange.side,
                        start: commentRange.start,
                        end: commentRange.end,
                      }}
                      onCancel={onCancelComment}
                      onSubmit={onCommentSaved}
                      originalCode={getOriginalCode()}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      ))}
      {isExpandable && onExpandContext && (() => {
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
