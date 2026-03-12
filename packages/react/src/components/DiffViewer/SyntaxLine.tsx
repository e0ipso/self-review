import React, { useState, useMemo, useEffect } from 'react';
import type Prism from 'prismjs';
import type { DiffLineType } from '@self-review/types';
import { getLanguageFromPath } from '../../../../core/src/file-type-utils';

// Module-level cache: Prism is loaded once and reused synchronously on all subsequent mounts.
let prismInstance: typeof Prism | null = null;
let prismReady: Promise<typeof Prism> | null = null;

/**
 * Load Prism.js and all grammar side-effects exactly once per module lifecycle.
 *
 * Grammar load order matters: prism-markup-templating must precede php, twig, smarty, etc.
 * prism-clike must precede javascript, java, c, cpp. prism-markup must precede jsx, tsx.
 * This order mirrors the previous static import order and MUST be preserved.
 */
function loadPrism(): Promise<typeof Prism> {
  if (!prismReady) {
    prismReady = import('prismjs').then(async (mod) => {
      // Base language components (order-sensitive)
      await import('prismjs/components/prism-markup');
      await import('prismjs/components/prism-markup-templating'); // Required for PHP and template languages
      await import('prismjs/components/prism-css');
      await import('prismjs/components/prism-clike');
      // JavaScript family
      await import('prismjs/components/prism-javascript');
      await import('prismjs/components/prism-typescript');
      await import('prismjs/components/prism-jsx');
      await import('prismjs/components/prism-tsx');
      // Other common languages
      await import('prismjs/components/prism-python');
      await import('prismjs/components/prism-json');
      await import('prismjs/components/prism-bash');
      await import('prismjs/components/prism-yaml');
      await import('prismjs/components/prism-markdown');
      await import('prismjs/components/prism-java');
      await import('prismjs/components/prism-go');
      await import('prismjs/components/prism-rust');
      await import('prismjs/components/prism-sql');
      await import('prismjs/components/prism-c');
      await import('prismjs/components/prism-cpp');
      await import('prismjs/components/prism-ruby');
      await import('prismjs/components/prism-php');
      await import('prismjs/components/prism-twig');
      // Config and data formats
      await import('prismjs/components/prism-ini');
      await import('prismjs/components/prism-toml');
      await import('prismjs/components/prism-csv');
      await import('prismjs/components/prism-diff');
      // Web and infrastructure
      await import('prismjs/components/prism-scss');
      await import('prismjs/components/prism-sass');
      await import('prismjs/components/prism-graphql');
      await import('prismjs/components/prism-nginx');
      await import('prismjs/components/prism-docker');
      // Database and tooling
      await import('prismjs/components/prism-mongodb');
      await import('prismjs/components/prism-makefile');
      await import('prismjs/components/prism-git');
      await import('prismjs/components/prism-vim');
      await import('prismjs/components/prism-xml-doc');

      prismInstance = mod.default ?? (mod as unknown as typeof Prism);
      return prismInstance;
    });
  }
  return prismReady;
}

export interface SyntaxLineProps {
  content: string;
  language: string;
  lineType: DiffLineType;
  wordWrap?: boolean;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\t/g, '    ');
}

function highlight(prism: typeof Prism, content: string, language: string): string {
  try {
    const prismLanguage = prism.languages[language];
    if (!prismLanguage || language === 'plaintext') {
      return escapeHtml(content);
    }
    return prism.highlight(content, prismLanguage, language);
  } catch (err) {
    console.error(`[Prism] Error for ${language}:`, err);
    return escapeHtml(content);
  }
}

const SyntaxLine = React.memo(function SyntaxLine({
  content,
  language,
  lineType: _lineType,
  wordWrap,
}: SyntaxLineProps) {
  // Hybrid rendering strategy:
  // - If Prism is already cached (warm load), highlight synchronously via useMemo — zero flicker.
  // - If Prism is not yet loaded (cold first load), show plain escaped text initially,
  //   then useEffect fires async load and updates state with highlighted HTML.
  const memoHtml = useMemo(() => {
    if (prismInstance) {
      return highlight(prismInstance, content, language);
    }
    return escapeHtml(content);
  }, [content, language]);

  const [html, setHtml] = useState(memoHtml);

  // Keep html in sync when memoHtml updates (covers warm-load prop changes)
  useEffect(() => {
    setHtml(memoHtml);
  }, [memoHtml]);

  // Cold-load path: asynchronously load Prism and re-render with highlighted output.
  useEffect(() => {
    if (prismInstance) return; // Already loaded — useMemo handles it synchronously
    let cancelled = false;
    loadPrism().then((prism) => {
      if (cancelled) return;
      setHtml(highlight(prism, content, language));
    });
    return () => {
      cancelled = true;
    };
  }, [content, language]);

  return (
    <code
      className={`font-mono text-[13px] ${wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'} block`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export default SyntaxLine;
export { getLanguageFromPath };
