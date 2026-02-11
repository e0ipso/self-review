import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import type { DiffFile, DiffLine } from '../../../shared/types';
import { useReview } from '../../context/ReviewContext';
import HunkHeader from './HunkHeader';
import SyntaxLine, { getLanguageFromPath } from './SyntaxLine';
import CommentInput from '../Comments/CommentInput';
import CommentDisplay from '../Comments/CommentDisplay';

export interface UnifiedViewProps {
  file: DiffFile;
  commentRange: { start: number; end: number; side: 'old' | 'new' } | null;
  dragState: { startLine: number; currentLine: number; side: 'old' | 'new' } | null;
  onDragStart: (lineNumber: number, side: 'old' | 'new') => void;
  onCancelComment: () => void;
  onCommentSaved: () => void;
}

export default function UnifiedView({
  file,
  commentRange,
  dragState,
  onDragStart,
  onCancelComment,
  onCommentSaved,
}: UnifiedViewProps) {
  const { getCommentsForLine } = useReview();
  const language = getLanguageFromPath(file.newPath || file.oldPath);

  const getLineBg = (line: DiffLine) => {
    if (line.type === 'addition') return 'bg-emerald-50/70 dark:bg-emerald-900/40';
    if (line.type === 'deletion') return 'bg-red-50/70 dark:bg-red-900/40';
    return '';
  };

  const getGutterBg = (line: DiffLine) => {
    if (line.type === 'addition') return 'bg-emerald-100/80 dark:bg-emerald-900/50';
    if (line.type === 'deletion') return 'bg-red-100/80 dark:bg-red-900/50';
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

  return (
    <div className="font-mono text-[13px] leading-[22px] unified-view">
      {file.hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex}>
          <HunkHeader header={hunk.header} />
          {hunk.lines.map((line, lineIndex) => {
            const rowIndex = hunkRowOffsets[hunkIndex] + lineIndex;
            const lineNumber = line.type === 'deletion' ? line.oldLineNumber : line.newLineNumber;
            const side: 'old' | 'new' = line.type === 'deletion' ? 'old' : 'new';
            const comments = lineNumber
              ? getCommentsForLine(filePath, lineNumber, side)
              : [];
            const commentsToRender = comments.filter(c => c.lineRange!.end === lineNumber);
            const showCommentInputHere = commentRange && lineNumber === commentRange.end && commentRange.side === side;

            // Comment range highlight: real line numbers + side
            const isInCommentRange = commentRange && commentRange.side === side && lineNumber !== null &&
              lineNumber >= commentRange.start && lineNumber <= commentRange.end;
            // Drag highlight: row indices (side-agnostic for cross-type drag)
            const isInDragRange = dragState !== null &&
              rowIndex >= Math.min(dragState.startLine, dragState.currentLine) &&
              rowIndex <= Math.max(dragState.startLine, dragState.currentLine);
            const isSelected = !!(isInCommentRange || isInDragRange);

            return (
              <React.Fragment key={`${hunkIndex}-${lineIndex}`}>
                <div className={`flex ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : getLineBg(line)} ${comments.length > 0 ? 'shadow-[inset_4px_0_0_0_#d97706] dark:shadow-[inset_4px_0_0_0_#fcd34d]' : ''} ${line.type === 'addition' ? 'diff-line-addition' : ''} ${line.type === 'deletion' ? 'diff-line-deletion' : ''}`} data-line-number={lineNumber || undefined} data-line-side={side} data-row-index={rowIndex}>
                  {/* Old line number */}
                  <div
                    className={`w-10 flex-shrink-0 text-right pr-2 text-[11px] leading-[22px] text-muted-foreground/70 select-none ${getGutterBg(line)} group/gutter-old relative`}
                    data-testid={line.oldLineNumber ? `old-line-${filePath}-${line.oldLineNumber}` : undefined}
                  >
                    {line.oldLineNumber && line.type !== 'context' && (
                      <button
                        className="absolute left-0 top-0 bottom-0 flex items-center justify-center w-7 opacity-0 group-hover/gutter-old:opacity-70 transition-opacity text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-400"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDragStart(rowIndex, 'old');
                        }}
                        data-testid={`comment-icon-old-${line.oldLineNumber}`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                    <span className="pointer-events-none">{line.oldLineNumber || ''}</span>
                  </div>
                  {/* New line number */}
                  <div
                    className={`w-10 flex-shrink-0 text-right pr-2 text-[11px] leading-[22px] text-muted-foreground/70 select-none ${getGutterBg(line)} group/gutter-new relative`}
                    data-testid={line.newLineNumber ? `new-line-${filePath}-${line.newLineNumber}` : undefined}
                  >
                    {line.newLineNumber && line.type !== 'context' && (
                      <button
                        className="absolute left-0 top-0 bottom-0 flex items-center justify-center w-7 opacity-0 group-hover/gutter-new:opacity-70 transition-opacity text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-400"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDragStart(rowIndex, 'new');
                        }}
                        data-testid={`comment-icon-new-${line.newLineNumber}`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                    <span className="pointer-events-none">{line.newLineNumber || ''}</span>
                  </div>
                  {/* Prefix */}
                  <div className={`line-prefix w-5 flex-shrink-0 text-center text-[11px] leading-[22px] select-none font-bold ${getPrefixColor(line)}`}>
                    {getLinePrefix(line)}
                  </div>
                  {/* Code content */}
                  <div className="flex-1 px-3 py-0.5 [overflow-x:overlay] leading-[22px]">
                    <SyntaxLine content={line.content} language={language} lineType={line.type} />
                  </div>
                </div>

                {/* Comments for this line (rendered at last line of range) */}
                {commentsToRender.map((comment) => (
                  <div key={comment.id} className="border-y border-border/50 bg-muted/20 px-4 py-3 ml-[100px]">
                    <CommentDisplay comment={comment} />
                  </div>
                ))}

                {/* Comment input */}
                {showCommentInputHere && (
                  <div className="border-y border-border/50 bg-muted/20 px-4 py-3 ml-[100px]">
                    <CommentInput
                      filePath={file.newPath || file.oldPath}
                      lineRange={{ side: commentRange.side, start: commentRange.start, end: commentRange.end }}
                      onCancel={onCancelComment}
                      onSubmit={onCommentSaved}
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
