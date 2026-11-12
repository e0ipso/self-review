import React, { useCallback, useLayoutEffect, useRef } from 'react';
import type { DiffLineType } from '@self-review/types';
import { useLocalization } from '../../localization/LocalizationContext';
import { getLineBg, getGutterBg } from '../../utils/diff-styles';
import { CommentGutterButton } from './CommentGutterButton';
import SyntaxLine from './SyntaxLine';

interface RawDiffRowProps {
  layout: 'unified' | 'old' | 'new';
  filePath: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  lineType: DiffLineType;
  content: string;
  language: string;
  wordWrap: boolean;
  isSelected: boolean;
  hasComment: boolean;
  rowIndex?: number;
  onDragStart: (lineNumber: number, side: 'old' | 'new', keyboard?: boolean) => void;
}

/** Row events use the last committed view callback, including after an interrupted render. */
export function useRawDragStart(onDragStart: RawDiffRowProps['onDragStart']) {
  const committed = useRef(onDragStart);
  useLayoutEffect(() => {
    committed.current = onDragStart;
  }, [onDragStart]);
  return useCallback<RawDiffRowProps['onDragStart']>((...args) => committed.current(...args), []);
}

/** Primitive props keep mutable source observable; feedback stays in the owning view. */
export const RawDiffRow = React.memo(function RawDiffRow({
  layout,
  filePath,
  oldLineNumber,
  newLineNumber,
  lineType,
  content,
  language,
  wordWrap,
  isSelected,
  hasComment,
  rowIndex,
  onDragStart,
}: RawDiffRowProps) {
  const { t } = useLocalization();
  const unified = layout === 'unified';
  const side = unified ? (lineType === 'deletion' ? 'old' : 'new') : layout;
  const lineNumber = side === 'old' ? oldLineNumber : newLineNumber;
  const line = { type: lineType, content, oldLineNumber, newLineNumber };

  const gutter = (gutterSide: 'old' | 'new', number: number | null) => {
    const group = unified ? `gutter-${gutterSide}` : 'gutter';
    // Unified drag coordinates are row indices, including zero; split uses source lines.
    const coordinate = unified ? rowIndex! : number!;
    return (
      <div
        className={`w-10 flex-shrink-0 text-end pe-2 text-[11px] leading-[22px] text-muted-foreground/70 select-none ${getGutterBg(line)} ${group === 'gutter-old' ? 'group/gutter-old' : group === 'gutter-new' ? 'group/gutter-new' : 'group/gutter'} relative`}
        data-testid={number ? `${gutterSide}-line-${filePath}-${number}` : undefined}
      >
        {number && (
          <CommentGutterButton
            className={`absolute start-0 top-1/2 -translate-y-1/2 opacity-0 ${group === 'gutter-old' ? 'group-hover/gutter-old:opacity-100' : group === 'gutter-new' ? 'group-hover/gutter-new:opacity-100' : 'group-hover/gutter:opacity-100'}`}
            label={t(
              gutterSide === 'old' ? 'Comment on old line {line}' : 'Comment on new line {line}',
              { line: number }
            )}
            onStartDrag={() => onDragStart(coordinate, gutterSide)}
            onActivate={() => onDragStart(coordinate, gutterSide, true)}
            data-testid={`comment-icon-${gutterSide}-${number}`}
          />
        )}
        <span className='pointer-events-none'>{number || ''}</span>
      </div>
    );
  };

  return (
    <div
      className={`${unified ? 'flex' : 'split-half w-1/2 flex'} ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : getLineBg(line)} ${hasComment ? 'shadow-[inset_4px_0_0_0_#d97706] dark:shadow-[inset_4px_0_0_0_#fcd34d]' : ''} ${lineType === 'addition' ? 'diff-line-addition' : ''} ${lineType === 'deletion' ? 'diff-line-deletion' : ''}`}
      style={unified ? { contentVisibility: 'auto', containIntrinsicSize: 'auto 26px' } : undefined}
      data-line-number={lineNumber || undefined}
      data-line-side={side}
      data-line-type={lineType}
      data-row-index={unified ? rowIndex : undefined}
    >
      {(unified || side === 'old') && gutter('old', oldLineNumber)}
      {(unified || side === 'new') && gutter('new', newLineNumber)}
      <div
        className={`flex-1 px-3 py-0.5 leading-[22px]${wordWrap ? '' : ' [overflow-x:overlay]'}`}
      >
        <SyntaxLine content={content} language={language} lineType={lineType} wordWrap={wordWrap} />
      </div>
    </div>
  );
});
