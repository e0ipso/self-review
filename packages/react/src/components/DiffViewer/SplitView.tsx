import { useLocalization } from '../../localization/LocalizationContext';
import React, { useMemo } from 'react';
import type { DiffFile, DiffLine } from '@self-review/types';
import { CommentGutterButton } from './CommentGutterButton';
import { useFileCommentIndex } from './useFileCommentIndex';
import { useConfig } from '../../context/ConfigContext';
import HunkHeader from './HunkHeader';
import SyntaxLine from './SyntaxLine';
import { planHighlighting } from './highlight-budget';
import { getLanguageFromPath } from '../../utils/file-type-utils';
import { extractOriginalCode } from './diff-utils';
import { InlineCommentSlot } from './InlineCommentSlot';
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
  const { t } = useLocalization();
  const commentIndex = useFileCommentIndex(file);
  const highlighting = useMemo(() => planHighlighting(file), [file]);
  const { config } = useConfig();
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

  const originalCode = useMemo(
    () => (commentRange ? extractOriginalCode(file, commentRange) : undefined),
    [file, commentRange]
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
          {buildSplitRows(hunk.lines).map((row, rowIndex) => {
            const oldLineNumber = row.oldLine?.oldLineNumber;
            const newLineNumber = row.newLine?.newLineNumber;
            const oldCommentsToRender = commentIndex.endingAt(oldLineNumber, 'old');
            const newCommentsToRender = commentIndex.endingAt(newLineNumber, 'new');
            const showCommentInputHere =
              commentRange &&
              ((commentRange.side === 'old' && oldLineNumber === commentRange.end) ||
                (commentRange.side === 'new' && newLineNumber === commentRange.end));

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

                <InlineCommentSlot
                  commentsToRender={[...oldCommentsToRender, ...newCommentsToRender]}
                  showCommentInput={!!showCommentInputHere}
                  commentRange={commentRange}
                  filePath={file.newPath || file.oldPath}
                  originalCode={originalCode}
                  onCancel={onCancelComment}
                  onSaved={onCommentSaved}
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
