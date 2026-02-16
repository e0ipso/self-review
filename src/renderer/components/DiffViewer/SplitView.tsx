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
    for (const line of lines) {
      if (line.type === 'context') {
        rows.push({ oldLine: line, newLine: line });
      } else if (line.type === 'addition') {
        rows.push({ oldLine: null, newLine: line });
      } else if (line.type === 'deletion') {
        rows.push({ oldLine: line, newLine: null });
      }
    }
    return rows;
  };

  const getLineBg = (line: DiffLine | null) => {
    if (!line) return '';
    if (line.type === 'addition')
      return 'bg-emerald-50/70 dark:bg-emerald-900/40';
    if (line.type === 'deletion') return 'bg-red-50/70 dark:bg-red-900/40';
    return '';
  };

  const getGutterBg = (line: DiffLine | null) => {
    if (!line) return 'bg-muted/30';
    if (line.type === 'addition')
      return 'bg-emerald-100/80 dark:bg-emerald-900/50';
    if (line.type === 'deletion') return 'bg-red-100/80 dark:bg-red-900/50';
    return 'bg-muted/30';
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
      return (
        <div className='w-1/2 flex'>
          <div className='w-10 flex-shrink-0 bg-muted/20' />
          <div className='flex-1 bg-muted/10' />
        </div>
      );
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

  return (
    <div className='font-mono text-[13px] leading-[22px] split-view'>
      {file.hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex}>
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
                    <div className='w-1/2 flex'>
                      <div className='w-10 flex-shrink-0 bg-muted/20' />
                      <div className='flex-1 bg-muted/10' />
                    </div>
                  )}
                  {/* New side (right) */}
                  {row.newLine ? (
                    renderLineCell(row.newLine, 'new', newComments.length > 0)
                  ) : (
                    <div className='w-1/2 flex'>
                      <div className='w-10 flex-shrink-0 bg-muted/20' />
                      <div className='flex-1 bg-muted/10' />
                    </div>
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
    </div>
  );
}
