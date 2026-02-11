import React from 'react';
import type { DiffLineType } from '../../../shared/types';

// Import Prism with components
import Prism from 'prismjs';
// Base language components
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

export interface SyntaxLineProps {
  content: string;
  language: string;
  lineType: DiffLineType;
}

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    css: 'css',
    json: 'json',
    md: 'markdown',
    sh: 'bash',
    bash: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
    java: 'java',
    go: 'go',
    rs: 'rust',
    sql: 'sql',
    html: 'markup',
    xml: 'markup',
    rb: 'ruby',
    php: 'php',
    twig: 'twig',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
  };
  return langMap[ext] || 'plaintext';
}

const SyntaxLine = React.memo(function SyntaxLine({
  content,
  language,
  lineType,
}: SyntaxLineProps) {
  const highlightedContent = React.useMemo(() => {
    try {
      const prismLanguage = Prism.languages[language];
      if (!prismLanguage || language === 'plaintext') {
        return content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\t/g, '    ');
      }
      return Prism.highlight(content, prismLanguage, language);
    } catch (err) {
      console.error(`[Prism] Error for ${language}:`, err);
      return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\t/g, '    ');
    }
  }, [content, language]);

  return (
    <code
      className="font-mono text-[13px] whitespace-pre block"
      dangerouslySetInnerHTML={{ __html: highlightedContent }}
    />
  );
});

export default SyntaxLine;
export { getLanguageFromPath };
