import React from 'react';
import type { DiffFile, DiffLine } from '../../../shared/types';
import { useReview } from '../../context/ReviewContext';
import HunkHeader from './HunkHeader';
import SyntaxLine, { getLanguageFromPath } from './SyntaxLine';
import CommentInput from '../Comments/CommentInput';
import CommentDisplay from '../Comments/CommentDisplay';

export interface SplitViewProps {
  file: DiffFile;
  commentingLine: { lineNumber: number; side: 'old' | 'new' } | null;
  selectionRange: { start: number; end: number; side: 'old' | 'new' } | null;
  onLineClick: (lineNumber: number, side: 'old' | 'new') => void;
  onLineRangeSelect: (start: number, end: number, side: 'old' | 'new') => void;
  onCancelComment: () => void;
}

interface SplitLineRow {
  oldLine: DiffLine | null;
  newLine: DiffLine | null;
}

export default function SplitView({
  file,
  commentingLine,
  selectionRange,
  onLineClick,
  onLineRangeSelect,
  onCancelComment,
}: SplitViewProps) {
  const { getCommentsForLine } = useReview();
  const filePath = file.newPath || file.oldPath;
  const language = getLanguageFromPath(filePath);

  const [rangeStart, setRangeStart] = React.useState<{ lineNumber: number; side: 'old' | 'new' } | null>(null);

  const handleLineMouseDown = (lineNumber: number, side: 'old' | 'new') => {
    setRangeStart({ lineNumber, side });
  };

  const handleLineMouseUp = (lineNumber: number, side: 'old' | 'new') => {
    if (rangeStart && rangeStart.side === side) {
      const start = Math.min(rangeStart.lineNumber, lineNumber);
      const end = Math.max(rangeStart.lineNumber, lineNumber);
      if (start !== end) {
        onLineRangeSelect(start, end, side);
      }
    }
    setRangeStart(null);
  };

  const isLineSelected = (lineNumber: number, side: 'old' | 'new') => {
    if (!selectionRange || selectionRange.side !== side) return false;
    return lineNumber >= selectionRange.start && lineNumber <= selectionRange.end;
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
    if (line.type === 'addition') return 'bg-emerald-50/70 dark:bg-emerald-950/20';
    if (line.type === 'deletion') return 'bg-red-50/70 dark:bg-red-950/20';
    return '';
  };

  const getGutterBg = (line: DiffLine | null) => {
    if (!line) return 'bg-muted/30';
    if (line.type === 'addition') return 'bg-emerald-100/80 dark:bg-emerald-900/20';
    if (line.type === 'deletion') return 'bg-red-100/80 dark:bg-red-900/20';
    return 'bg-muted/30';
  };

  const renderLineCell = (
    line: DiffLine | null,
    side: 'old' | 'new',
  ) => {
    if (!line) {
      return (
        <div className="w-1/2 flex">
          <div className="w-10 flex-shrink-0 bg-muted/20" />
          <div className="flex-1 bg-muted/10" />
        </div>
      );
    }

    const lineNumber = side === 'old' ? line.oldLineNumber : line.newLineNumber;
    const isSelected = lineNumber ? isLineSelected(lineNumber, side) : false;

    const lineTestId = lineNumber
      ? `${side === 'old' ? 'old' : 'new'}-line-${filePath}-${lineNumber}`
      : undefined;

    return (
      <div className={`split-half w-1/2 flex ${getLineBg(line)} ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''} ${line.type === 'addition' ? 'diff-line-addition' : ''} ${line.type === 'deletion' ? 'diff-line-deletion' : ''}`}>
        {/* Line number gutter */}
        <div
          className={`w-10 flex-shrink-0 text-right pr-2 text-[11px] leading-[20px] text-muted-foreground/70 select-none cursor-pointer hover:text-foreground transition-colors ${getGutterBg(line)}`}
          data-testid={lineTestId}
          onMouseDown={() => lineNumber && handleLineMouseDown(lineNumber, side)}
          onMouseUp={() => lineNumber && handleLineMouseUp(lineNumber, side)}
          onClick={() => lineNumber && onLineClick(lineNumber, side)}
        >
          {lineNumber || ''}
        </div>
        {/* Code content */}
        <div className="flex-1 px-2 overflow-x-auto leading-[20px]">
          <SyntaxLine content={line.content} language={language} lineType={line.type} />
        </div>
      </div>
    );
  };

  return (
    <div className="font-mono text-[13px] leading-[20px] split-view">
      {file.hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex}>
          <HunkHeader header={hunk.header} />
          {buildSplitRows(hunk.lines).map((row, rowIndex) => {
            const oldLineNumber = row.oldLine?.oldLineNumber;
            const newLineNumber = row.newLine?.newLineNumber;
            const oldComments = oldLineNumber
              ? getCommentsForLine(file.newPath || file.oldPath, oldLineNumber, 'old')
              : [];
            const newComments = newLineNumber
              ? getCommentsForLine(file.newPath || file.oldPath, newLineNumber, 'new')
              : [];
            const hasComments = oldComments.length > 0 || newComments.length > 0;
            const isOldCommenting = commentingLine?.lineNumber === oldLineNumber && commentingLine?.side === 'old';
            const isNewCommenting = commentingLine?.lineNumber === newLineNumber && commentingLine?.side === 'new';
            const hasCommentInput = isOldCommenting || isNewCommenting;

            return (
              <React.Fragment key={`${hunkIndex}-${rowIndex}`}>
                <div className="flex border-b border-transparent hover:border-border/30">
                  {/* Old side (left) */}
                  {row.oldLine ? (
                    renderLineCell(row.oldLine, 'old')
                  ) : (
                    <div className="w-1/2 flex">
                      <div className="w-10 flex-shrink-0 bg-muted/20" />
                      <div className="flex-1 bg-muted/10" />
                    </div>
                  )}
                  {/* New side (right) */}
                  {row.newLine ? (
                    renderLineCell(row.newLine, 'new')
                  ) : (
                    <div className="w-1/2 flex">
                      <div className="w-10 flex-shrink-0 bg-muted/20" />
                      <div className="flex-1 bg-muted/10" />
                    </div>
                  )}
                </div>

                {/* Comments spanning full width */}
                {hasComments && (
                  <div className="border-y border-border/50 bg-muted/20 px-4 py-3 space-y-2">
                    {oldComments.map((comment) => (
                      <CommentDisplay key={comment.id} comment={comment} />
                    ))}
                    {newComments.map((comment) => (
                      <CommentDisplay key={comment.id} comment={comment} />
                    ))}
                  </div>
                )}

                {/* Comment input spanning full width */}
                {hasCommentInput && (
                  <div className="border-y border-border/50 bg-muted/20 px-4 py-3">
                    <CommentInput
                      filePath={file.newPath || file.oldPath}
                      lineRange={
                        isOldCommenting && oldLineNumber
                          ? { side: 'old', start: oldLineNumber, end: oldLineNumber }
                          : isNewCommenting && newLineNumber
                          ? { side: 'new', start: newLineNumber, end: newLineNumber }
                          : null
                      }
                      onCancel={onCancelComment}
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
