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
    <div className="mt-2 rounded border border-border bg-muted/30 text-sm font-mono" data-testid="suggestion-block">
      <div className="border-b border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground">
        Suggested change
      </div>
      <div className="divide-y divide-border">
        {originalLines.map((line, idx) => (
          <div
            key={`old-${idx}`}
            className="suggestion-deletion flex bg-red-50 dark:bg-red-950/20"
          >
            <span className="inline-block w-8 flex-shrink-0 select-none px-2 text-red-600 dark:text-red-400">
              -
            </span>
            <span
              className="flex-1 text-red-800 dark:text-red-200"
              dangerouslySetInnerHTML={{
                __html: highlightCode(line, language),
              }}
            />
          </div>
        ))}
        {proposedLines.map((line, idx) => (
          <div
            key={`new-${idx}`}
            className="suggestion-addition flex bg-green-50 dark:bg-green-950/20"
          >
            <span className="inline-block w-8 flex-shrink-0 select-none px-2 text-green-600 dark:text-green-400">
              +
            </span>
            <span
              className="flex-1 text-green-800 dark:text-green-200"
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
