import { useLocalization } from '../../localization/LocalizationContext';
import React, { useMemo } from 'react';
import type { DiffFile } from '@self-review/types';
import { CommentGutterButton } from './CommentGutterButton';
import { useRawDiffAnnotations } from './useRawDiffAnnotations';
import { HunkSeparator } from './HunkSeparator';
import { useAppearance } from '../../context/ConfigContext';
import SyntaxLine from './SyntaxLine';
import { planHighlighting } from './highlight-budget';
import { getLanguageFromPath } from '../../utils/file-type-utils';
import { InlineCommentSlot } from './InlineCommentSlot';
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
