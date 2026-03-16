import React, { useMemo } from 'react';
import Prism from 'prismjs';
import type { DiffLineType } from '@self-review/types';
import { getLanguageFromPath } from '../../utils/file-type-utils';

// Base language components (order-sensitive)
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-markup-templating'; // Required for PHP and template languages
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike';
// JavaScript family
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
// Other common languages
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-twig';
// Config and data formats
import 'prismjs/components/prism-ini';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-csv';
import 'prismjs/components/prism-diff';
// Web and infrastructure
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-sass';
import 'prismjs/components/prism-graphql';
import 'prismjs/components/prism-nginx';
import 'prismjs/components/prism-docker';
// Database and tooling
import 'prismjs/components/prism-mongodb';
import 'prismjs/components/prism-makefile';
import 'prismjs/components/prism-git';
import 'prismjs/components/prism-vim';
import 'prismjs/components/prism-xml-doc';

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
  const html = useMemo(
    () => highlight(Prism, content, language),
    [content, language],
  );

  return (
    <code
      className={`font-mono text-[13px] ${wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'} block`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export default SyntaxLine;
export { getLanguageFromPath };
