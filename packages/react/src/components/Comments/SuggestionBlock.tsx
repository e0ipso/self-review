import React from 'react';
import { useLocalization } from '../../localization/LocalizationContext';
import Prism from 'prismjs';
import { createHighlightBudget } from '../DiffViewer/highlight-budget';
import type { LineRange, Suggestion } from '@self-review/types';
import SuggestionApplyControl from './SuggestionApplyControl';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';

export interface SuggestionBlockProps {
  suggestion: Suggestion;
  language?: string;
  /**
   * Path of the file the owning comment is anchored in, relative to the
   * review root. Omitted where the block has no owning comment (previews in
   * the composer), and the Apply control is then never offered.
   */
  filePath?: string;
  /** The owning comment's anchor. `null` means a file-level comment. */
  lineRange?: LineRange | null;
}

export default function SuggestionBlock({
  suggestion,
  language = 'typescript',
  filePath,
  lineRange = null,
}: SuggestionBlockProps) {
  const { t } = useLocalization();
  const budget = createHighlightBudget();
  const highlightCode = (code: string, lang: string): string | null => {
    if (!budget.admit(code)) return null;
    try {
      const grammar = Prism.languages[lang] || Prism.languages.plaintext;
      return Prism.highlight(code, grammar, lang);
    } catch {
      return null;
    }
  };

  const originalLines = suggestion.originalCode
    .split('\n')
    .map(line => ({ line, html: highlightCode(line, language) }));
  const proposedLines = suggestion.proposedCode
    .split('\n')
    .map(line => ({ line, html: highlightCode(line, language) }));

  return (
    <div
      className='rounded-md border border-border overflow-hidden text-xs font-mono'
      data-testid='suggestion-block'
    >
      <div className='flex items-center h-7 px-3 bg-muted text-[11px] font-semibold text-muted-foreground uppercase tracking-wider'>
        {t('Suggested change')}
      </div>
      {budget.limited && (
        <p role='status' className='px-3 py-1 font-sans text-muted-foreground'>
          {t('Highlighting is limited for this suggestion. All code remains available.')}
        </p>
      )}
      <div>
        {originalLines.map(({ line, html }, idx) => (
          <div
            key={`old-${idx}`}
            className='suggestion-deletion flex bg-red-50/70 dark:bg-red-900/35 leading-[20px]'
          >
            <span className='inline-flex items-center justify-center w-7 flex-shrink-0 select-none text-red-500 dark:text-red-400 font-bold text-[11px]'>
              -
            </span>
            <span
              className='flex-1 text-foreground/80 whitespace-pre'
              dangerouslySetInnerHTML={html === null ? undefined : { __html: html }}
            >
              {html === null ? line : undefined}
            </span>
          </div>
        ))}
        {proposedLines.map(({ line, html }, idx) => (
          <div
            key={`new-${idx}`}
            className='suggestion-addition flex bg-emerald-50/70 dark:bg-emerald-900/35 leading-[20px]'
          >
            <span className='inline-flex items-center justify-center w-7 flex-shrink-0 select-none text-emerald-500 dark:text-emerald-400 font-bold text-[11px]'>
              +
            </span>
            <span
              className='flex-1 text-foreground/80 whitespace-pre'
              dangerouslySetInnerHTML={html === null ? undefined : { __html: html }}
            >
              {html === null ? line : undefined}
            </span>
          </div>
        ))}
      </div>
      {filePath !== undefined && (
        <SuggestionApplyControl filePath={filePath} lineRange={lineRange} suggestion={suggestion} />
      )}
    </div>
  );
}
