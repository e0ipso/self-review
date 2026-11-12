import { useLocalization } from '../../localization/LocalizationContext';
import React, { useMemo } from 'react';
import type { DiffFile, DiffLine } from '@self-review/types';
import { CommentGutterButton } from './CommentGutterButton';
import { useRawDiffAnnotations } from './useRawDiffAnnotations';
import { HunkSeparator } from './HunkSeparator';
import { useAppearance } from '../../context/ConfigContext';
import SyntaxLine from './SyntaxLine';
import { planHighlighting } from './highlight-budget';
import { getLanguageFromPath } from '../../utils/file-type-utils';
import { InlineCommentSlot } from './InlineCommentSlot';
import { getLineBg, getGutterBg } from '../../utils/diff-styles';
import { buildSplitRows } from './split-rows';
import EmptyLinePane from './EmptyLinePane';

export interface SplitViewProps {
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
  const { t } = useLocalization();
  const { commentIndex, originalCode, feedbackAt, getOriginalCodeForComment } =
    useRawDiffAnnotations(file, commentRange);
  const highlighting = useMemo(() => planHighlighting(file), [file]);
  const config = useAppearance();
  const filePath = file.newPath || file.oldPath;
  const language = getLanguageFromPath(filePath);

  const isLineSelected = (lineNumber: number, side: 'old' | 'new') => {
    if (commentRange && commentRange.side === side) {
      if (lineNumber >= commentRange.start && lineNumber <= commentRange.end) return true;
    }
    if (dragState && dragState.side === side) {
      const min = Math.min(dragState.startLine, dragState.currentLine);
      const max = Math.max(dragState.startLine, dragState.currentLine);
      if (lineNumber >= min && lineNumber <= max) return true;
    }
    return false;
  };

  const splitHunks = useMemo(
    () => file.hunks.map(hunk => buildSplitRows(hunk.lines)),
    [file.hunks]
  );

  const renderLineCell = (line: DiffLine | null, side: 'old' | 'new', hasComment = false) => {
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
          className={`w-10 flex-shrink-0 text-end pe-2 text-[11px] leading-[22px] text-muted-foreground/70 select-none ${getGutterBg(line)} group/gutter relative`}
          data-testid={lineTestId}
        >
          {lineNumber && (
            <CommentGutterButton
              className='absolute start-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/gutter:opacity-100'
              label={t(
                side === 'old' ? 'Comment on old line {line}' : 'Comment on new line {line}',
                { line: lineNumber! }
              )}
              onStartDrag={() => onDragStart(lineNumber!, side)}
              onActivate={() => onDragStart(lineNumber!, side, true)}
              data-testid={`comment-icon-${side}-${lineNumber}`}
            />
          )}
          <span className='pointer-events-none'>{lineNumber || ''}</span>
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
    );
  };

  return (
    <div className='font-mono text-[13px] leading-[22px] split-view'>
      {highlighting.limited && (
        <p role='status' className='px-3 py-1 text-xs font-sans text-muted-foreground'>
          {t('Highlighting is limited for this file. All source lines remain available.')}
        </p>
      )}
      {file.hunks.map((_, hunkIndex) => (
        <div key={hunkIndex}>
          <HunkSeparator
            hunks={file.hunks}
            hunkIndex={hunkIndex}
            isExpandable={isExpandable}
            onExpandContext={onExpandContext}
            expandLoading={expandLoading}
            totalLines={totalLines}
          />
          {splitHunks[hunkIndex].map((row, rowIndex) => {
            const oldLineNumber = row.oldLine?.oldLineNumber;
            const newLineNumber = row.newLine?.newLineNumber;
            const { comments: commentsToRender, showInput: showCommentInputHere } = feedbackAt(
              oldLineNumber,
              newLineNumber,
              'old'
            );

            return (
              <React.Fragment key={`${hunkIndex}-${rowIndex}`}>
                <div
                  className='flex'
                  style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 26px' }}
                >
                  {/* Old side (left) */}
                  {row.oldLine ? (
                    renderLineCell(row.oldLine, 'old', commentIndex.covers(oldLineNumber, 'old'))
                  ) : (
                    <EmptyLinePane />
                  )}
                  {/* New side (right) */}
                  {row.newLine ? (
                    renderLineCell(row.newLine, 'new', commentIndex.covers(newLineNumber, 'new'))
                  ) : (
                    <EmptyLinePane />
                  )}
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
