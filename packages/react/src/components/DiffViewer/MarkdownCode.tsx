import React from 'react';
import Prism from 'prismjs';
import type { ExtraProps } from 'react-markdown';
import MermaidBlock from './MermaidBlock';

/**
 * Shared `code` renderer for ReactMarkdown: renders ```mermaid fences as
 * diagrams via MermaidBlock and highlights other fenced blocks with Prism.
 * Used by RenderedMarkdownView and GuideOverviewPanel.
 */
export function MarkdownCode({
  className,
  children,
  node,
  ...props
}: React.HTMLAttributes<HTMLElement> & ExtraProps) {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  // Check if this is a block-level code (inside <pre>)
  const isBlock = node?.position;

  if (lang === 'mermaid' && isBlock) {
    return <MermaidBlock code={code} />;
  }

  if (lang && Prism.languages[lang]) {
    const html = Prism.highlight(code, Prism.languages[lang], lang);
    return (
      <code
        className={className}
        dangerouslySetInnerHTML={{ __html: html }}
        {...props}
      />
    );
  }
  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}
