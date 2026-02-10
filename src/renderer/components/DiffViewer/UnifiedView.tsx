import React from 'react';
import type { DiffFile, DiffLine } from '../../../shared/types';
import { useReview } from '../../context/ReviewContext';
import HunkHeader from './HunkHeader';
import SyntaxLine, { getLanguageFromPath } from './SyntaxLine';
import CommentInput from '../Comments/CommentInput';
import CommentDisplay from '../Comments/CommentDisplay';

export interface UnifiedViewProps {
  file: DiffFile;
  commentingLine: { lineNumber: number; side: 'old' | 'new' } | null;
  selectionRange: { start: number; end: number; side: 'old' | 'new' } | null;
  onLineClick: (lineNumber: number, side: 'old' | 'new') => void;
  onLineRangeSelect: (start: number, end: number, side: 'old' | 'new') => void;
  onCancelComment: () => void;
}

export default function UnifiedView({
  file,
  commentingLine,
  selectionRange,
  onLineClick,
  onLineRangeSelect,
  onCancelComment,
}: UnifiedViewProps) {
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

  const getLineBackground = (line: DiffLine) => {
    switch (line.type) {
      case 'addition':
        return 'bg-green-50 dark:bg-green-950/30';
      case 'deletion':
        return 'bg-red-50 dark:bg-red-950/30';
      default:
        return '';
    }
  };

  const getLinePrefix = (line: DiffLine) => {
    switch (line.type) {
      case 'addition':
        return '+';
      case 'deletion':
        return '-';
      default:
        return ' ';
    }
  };

  const isLineSelected = (lineNumber: number, side: 'old' | 'new') => {
    if (!selectionRange || selectionRange.side !== side) return false;
    return lineNumber >= selectionRange.start && lineNumber <= selectionRange.end;
  };

  return (
    <div className="font-mono text-sm">
      {file.hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex}>
          <HunkHeader header={hunk.header} />
          {hunk.lines.map((line, lineIndex) => {
            const lineNumber = line.type === 'deletion' ? line.oldLineNumber : line.newLineNumber;
            const side = line.type === 'deletion' ? 'old' : 'new';
            const comments = lineNumber
              ? getCommentsForLine(file.newPath || file.oldPath, lineNumber, side)
              : [];
            const isCommenting = commentingLine?.lineNumber === lineNumber && commentingLine?.side === side;
            const isSelected = lineNumber ? isLineSelected(lineNumber, side) : false;

            return (
              <React.Fragment key={`${hunkIndex}-${lineIndex}`}>
                <div className={`flex ${getLineBackground(line)} ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}>
                  {/* Old line number gutter */}
                  <div
                    className="w-12 text-right px-2 text-muted-foreground select-none cursor-pointer hover:bg-muted/50"
                    onMouseDown={() => line.oldLineNumber && handleLineMouseDown(line.oldLineNumber, 'old')}
                    onMouseUp={() => line.oldLineNumber && handleLineMouseUp(line.oldLineNumber, 'old')}
                    onClick={() => line.oldLineNumber && onLineClick(line.oldLineNumber, 'old')}
                  >
                    {line.oldLineNumber || ''}
                  </div>
                  {/* New line number gutter */}
                  <div
                    className="w-12 text-right px-2 text-muted-foreground select-none cursor-pointer hover:bg-muted/50"
                    onMouseDown={() => line.newLineNumber && handleLineMouseDown(line.newLineNumber, 'new')}
                    onMouseUp={() => line.newLineNumber && handleLineMouseUp(line.newLineNumber, 'new')}
                    onClick={() => line.newLineNumber && onLineClick(line.newLineNumber, 'new')}
                  >
                    {line.newLineNumber || ''}
                  </div>
                  {/* Prefix */}
                  <div className="w-6 text-center px-1 text-muted-foreground select-none">
                    {getLinePrefix(line)}
                  </div>
                  {/* Code content */}
                  <div className="flex-1 px-2 overflow-x-auto">
                    <SyntaxLine content={line.content} language={language} lineType={line.type} />
                  </div>
                </div>

                {/* Comments for this line */}
                {comments.map((comment) => (
                  <div key={comment.id} className="border-l-4 border-blue-500 bg-muted/30 p-4 ml-24">
                    <CommentDisplay comment={comment} />
                  </div>
                ))}

                {/* Comment input if user is commenting on this line */}
                {isCommenting && lineNumber && (
                  <div className="border-l-4 border-blue-500 bg-muted/30 p-4 ml-24">
                    <CommentInput
                      filePath={file.newPath || file.oldPath}
                      lineRange={{ side, start: lineNumber, end: lineNumber }}
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
