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
  const language = getLanguageFromPath(file.newPath || file.oldPath);

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

  // Convert hunk lines into split view rows
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

  const renderLineCell = (
    line: DiffLine | null,
    side: 'old' | 'new',
    hunkIndex: number,
    rowIndex: number
  ) => {
    if (!line) {
      // Empty cell (spacer)
      return (
        <div className="w-1/2 flex border-r border-border">
          <div className="w-12 bg-muted/20"></div>
          <div className="flex-1 bg-muted/10"></div>
        </div>
      );
    }

    const lineNumber = side === 'old' ? line.oldLineNumber : line.newLineNumber;
    const isSelected = lineNumber ? isLineSelected(lineNumber, side) : false;

    const bgColor =
      line.type === 'addition'
        ? 'bg-green-50 dark:bg-green-950/30'
        : line.type === 'deletion'
        ? 'bg-red-50 dark:bg-red-950/30'
        : '';

    const lineTestId = lineNumber
      ? `${side === 'old' ? 'old' : 'new'}-line-${filePath}-${lineNumber}`
      : undefined;

    return (
      <div className={`split-half w-1/2 flex border-r border-border ${bgColor} ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''} ${line.type === 'addition' ? 'diff-line-addition' : ''} ${line.type === 'deletion' ? 'diff-line-deletion' : ''}`}>
        {/* Line number gutter */}
        <div
          className="w-12 text-right px-2 text-muted-foreground select-none cursor-pointer hover:bg-muted/50"
          data-testid={lineTestId}
          onMouseDown={() => lineNumber && handleLineMouseDown(lineNumber, side)}
          onMouseUp={() => lineNumber && handleLineMouseUp(lineNumber, side)}
          onClick={() => lineNumber && onLineClick(lineNumber, side)}
        >
          {lineNumber || ''}
        </div>
        {/* Code content */}
        <div className="flex-1 px-2 overflow-x-auto">
          <SyntaxLine content={line.content} language={language} lineType={line.type} />
        </div>
      </div>
    );
  };

  const filePath = file.newPath || file.oldPath;

  return (
    <div className="font-mono text-sm split-view">
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
                <div className="flex">
                  {/* Old side (left) */}
                  {row.oldLine ? (
                    renderLineCell(row.oldLine, 'old', hunkIndex, rowIndex)
                  ) : (
                    <div className="w-1/2 flex border-r border-border">
                      <div className="w-12 bg-muted/20"></div>
                      <div className="flex-1 bg-muted/10"></div>
                    </div>
                  )}
                  {/* New side (right) */}
                  {row.newLine ? (
                    renderLineCell(row.newLine, 'new', hunkIndex, rowIndex)
                  ) : (
                    <div className="w-1/2 flex">
                      <div className="w-12 bg-muted/20"></div>
                      <div className="flex-1 bg-muted/10"></div>
                    </div>
                  )}
                </div>

                {/* Comments spanning full width */}
                {hasComments && (
                  <div className="border-l-4 border-blue-500 bg-muted/30 p-4">
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
                  <div className="border-l-4 border-blue-500 bg-muted/30 p-4">
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
