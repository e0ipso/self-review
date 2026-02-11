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

  const getLineBg = (line: DiffLine) => {
    if (line.type === 'addition') return 'bg-emerald-50/70 dark:bg-emerald-950/20';
    if (line.type === 'deletion') return 'bg-red-50/70 dark:bg-red-950/20';
    return '';
  };

  const getGutterBg = (line: DiffLine) => {
    if (line.type === 'addition') return 'bg-emerald-100/80 dark:bg-emerald-900/20';
    if (line.type === 'deletion') return 'bg-red-100/80 dark:bg-red-900/20';
    return 'bg-muted/30';
  };

  const getLinePrefix = (line: DiffLine) => {
    switch (line.type) {
      case 'addition': return '+';
      case 'deletion': return '-';
      default: return ' ';
    }
  };

  const getPrefixColor = (line: DiffLine) => {
    if (line.type === 'addition') return 'text-emerald-600 dark:text-emerald-400';
    if (line.type === 'deletion') return 'text-red-600 dark:text-red-400';
    return 'text-muted-foreground/50';
  };

  const isLineSelected = (lineNumber: number, side: 'old' | 'new') => {
    if (!selectionRange || selectionRange.side !== side) return false;
    return lineNumber >= selectionRange.start && lineNumber <= selectionRange.end;
  };

  const filePath = file.newPath || file.oldPath;

  return (
    <div className="font-mono text-[13px] leading-[22px] unified-view">
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
                <div className={`flex ${getLineBg(line)} ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''} ${line.type === 'addition' ? 'diff-line-addition' : ''} ${line.type === 'deletion' ? 'diff-line-deletion' : ''}`}>
                  {/* Old line number */}
                  <div
                    className={`w-10 flex-shrink-0 text-right pr-2 text-[11px] leading-[22px] text-muted-foreground/70 select-none cursor-pointer hover:text-foreground transition-colors ${getGutterBg(line)}`}
                    data-testid={line.oldLineNumber ? `old-line-${filePath}-${line.oldLineNumber}` : undefined}
                    onMouseDown={() => line.oldLineNumber && handleLineMouseDown(line.oldLineNumber, 'old')}
                    onMouseUp={() => line.oldLineNumber && handleLineMouseUp(line.oldLineNumber, 'old')}
                    onClick={() => line.oldLineNumber && onLineClick(line.oldLineNumber, 'old')}
                  >
                    {line.oldLineNumber || ''}
                  </div>
                  {/* New line number */}
                  <div
                    className={`w-10 flex-shrink-0 text-right pr-2 text-[11px] leading-[22px] text-muted-foreground/70 select-none cursor-pointer hover:text-foreground transition-colors ${getGutterBg(line)}`}
                    data-testid={line.newLineNumber ? `new-line-${filePath}-${line.newLineNumber}` : undefined}
                    onMouseDown={() => line.newLineNumber && handleLineMouseDown(line.newLineNumber, 'new')}
                    onMouseUp={() => line.newLineNumber && handleLineMouseUp(line.newLineNumber, 'new')}
                    onClick={() => line.newLineNumber && onLineClick(line.newLineNumber, 'new')}
                  >
                    {line.newLineNumber || ''}
                  </div>
                  {/* Prefix */}
                  <div className={`line-prefix w-5 flex-shrink-0 text-center text-[11px] leading-[22px] select-none font-bold ${getPrefixColor(line)}`}>
                    {getLinePrefix(line)}
                  </div>
                  {/* Code content */}
                  <div className="flex-1 px-3 py-0.5 overflow-x-auto leading-[22px]">
                    <SyntaxLine content={line.content} language={language} lineType={line.type} />
                  </div>
                </div>

                {/* Comments for this line */}
                {comments.map((comment) => (
                  <div key={comment.id} className="border-y border-border/50 bg-muted/20 px-4 py-3 ml-[100px]">
                    <CommentDisplay comment={comment} />
                  </div>
                ))}

                {/* Comment input */}
                {isCommenting && lineNumber && (
                  <div className="border-y border-border/50 bg-muted/20 px-4 py-3 ml-[100px]">
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
