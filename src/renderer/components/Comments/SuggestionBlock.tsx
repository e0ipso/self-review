import React from 'react';
import Prism from 'prismjs';
import type { Suggestion } from '../../../shared/types';
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
}

export default function SuggestionBlock({ suggestion, language = 'typescript' }: SuggestionBlockProps) {
  const highlightCode = (code: string, lang: string): string => {
    try {
      const grammar = Prism.languages[lang] || Prism.languages.plaintext;
      return Prism.highlight(code, grammar, lang);
    } catch {
      return code;
    }
  };

  const originalLines = suggestion.originalCode.split('\n');
  const proposedLines = suggestion.proposedCode.split('\n');

  return (
    <div className="rounded-md border border-border overflow-hidden text-xs font-mono" data-testid="suggestion-block">
      <div className="flex items-center h-7 px-3 bg-muted text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        Suggested change
      </div>
      <div>
        {originalLines.map((line, idx) => (
          <div
            key={`old-${idx}`}
            className="suggestion-deletion flex bg-red-50/70 dark:bg-red-950/15 leading-[20px]"
          >
            <span className="inline-flex items-center justify-center w-7 flex-shrink-0 select-none text-red-500 dark:text-red-400 font-bold text-[11px]">
              -
            </span>
            <span
              className="flex-1 text-foreground/80"
              dangerouslySetInnerHTML={{
                __html: highlightCode(line, language),
              }}
            />
          </div>
        ))}
        {proposedLines.map((line, idx) => (
          <div
            key={`new-${idx}`}
            className="suggestion-addition flex bg-emerald-50/70 dark:bg-emerald-950/15 leading-[20px]"
          >
            <span className="inline-flex items-center justify-center w-7 flex-shrink-0 select-none text-emerald-500 dark:text-emerald-400 font-bold text-[11px]">
              +
            </span>
            <span
              className="flex-1 text-foreground/80"
              dangerouslySetInnerHTML={{
                __html: highlightCode(line, language),
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
