import React, { useMemo, useCallback, createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Components, ExtraProps } from 'react-markdown';
import { MessageSquarePlus } from 'lucide-react';
import Prism from 'prismjs';
import type { DiffFile, LineRange } from '@self-review/core';
import { useReview } from '../../context/ReviewContext';
import CommentInput from '../Comments/CommentInput';
import CommentDisplay from '../Comments/CommentDisplay';
import { extractOriginalCode } from './diff-utils';
import MermaidBlock from './MermaidBlock';
import { remarkEmoji } from '../../utils/remark-emoji';

// ===== Nesting Context =====
// Tracks whether we're inside a block that already has a gutter wrapper,
// so nested elements (li inside ul, p inside blockquote) don't duplicate it.

const GutterNestingContext = createContext(false);

// ===== Content Extraction =====

function extractFileContent(file: DiffFile): string {
  return file.hunks
    .flatMap(hunk => hunk.lines)
    .filter(line => line.type === 'addition')
    .map(line => line.content.slice(1))
    .join('\n');
}

// Tags that accept phrasing (inline) content — the Tag itself can be the
// positioned container with the gutter <span> inside. Tags NOT in this set
// (ul, ol, table, hr) need a wrapper <div> because they can't contain inline
// children directly.
const INLINE_SAFE_TAGS: ReadonlySet<string> = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'li', 'details',
]);

// ===== Block Wrapper with Gutter =====

interface BlockWrapperProps {
  startLine: number | undefined;
  endLine: number | undefined;
  children: React.ReactNode;
  tag: keyof React.JSX.IntrinsicElements;
  className?: string;
  filePath: string;
  file: DiffFile;
  commentRange: LineRange | null;
  onGutterMouseDown: (startLine: number, endLine: number) => void;
  onCancelComment: () => void;
  onCommentSaved: () => void;
  tagProps?: Record<string, unknown>;
}

function BlockWrapper({
  startLine,
  endLine,
  children,
  tag: Tag,
  className,
  filePath,
  file,
  commentRange,
  onGutterMouseDown,
  onCancelComment,
  onCommentSaved,
  tagProps,
}: BlockWrapperProps) {
  const { getCommentsForFile } = useReview();
  const isNested = useContext(GutterNestingContext);

  // If nested inside another gutter-wrapped block, or no position data,
  // render the tag directly without a gutter row.
  if (isNested || startLine === undefined || endLine === undefined) {
    return <Tag className={className} {...tagProps}>{children}</Tag>;
  }

  const rangeLabel = startLine === endLine ? `${startLine}` : `${startLine}-${endLine}`;

  // Find comments overlapping this block's range
  const blockComments = getCommentsForFile(filePath).filter(c => {
    if (!c.lineRange || c.lineRange.side !== 'new') return false;
    return c.lineRange.start <= endLine && c.lineRange.end >= startLine;
  });

  // Show comment input below this block if the comment range ends within this block
  const showCommentInput = commentRange &&
    commentRange.side === 'new' &&
    commentRange.end >= startLine &&
    commentRange.end <= endLine;

  // Void elements (hr, img, etc.) can't have children
  const isVoid = Tag === 'hr';

  // Tags that accept phrasing (inline) content as children — the Tag itself
  // becomes the positioned container so that selectors like `p.rendered-block`
  // work and the gutter is a descendant of the semantic element.
  // Tags that don't (ul, ol, table) keep a wrapper <div>.
  const isInlineSafe = INLINE_SAFE_TAGS.has(Tag as string);
  const GutterEl = isInlineSafe ? 'span' : 'div';

  const gutter = (
    <GutterEl
      className='rendered-gutter absolute left-0 top-0 w-16 text-right pr-2 select-none cursor-pointer text-[11px] text-muted-foreground/70'
      style={{ lineHeight: 'inherit' }}
      onMouseDown={e => {
        e.preventDefault();
        e.stopPropagation();
        onGutterMouseDown(startLine, endLine);
      }}
    >
      <button
        className='absolute left-0 top-0 h-[1lh] flex items-center justify-center w-7 opacity-0 group-hover/rendered-block:opacity-100 transition-all cursor-pointer text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 dark:hover:text-white rounded-sm'
        tabIndex={-1}
      >
        <MessageSquarePlus className='h-4 w-4' />
      </button>
      <span className='pointer-events-none'>{rangeLabel}</span>
    </GutterEl>
  );

  const blockClassName = [className, 'rendered-block group/rendered-block relative']
    .filter(Boolean)
    .join(' ');

  const commentElements = (
    <>
      {/* Existing comments for this block */}
      {blockComments.map(comment => (
        <div
          key={comment.id}
          className='border-y border-border bg-muted/50 px-4 py-3 ml-16'
        >
          <CommentDisplay
            comment={comment}
            originalCode={comment.lineRange ? extractOriginalCode(file, comment.lineRange) : undefined}
          />
        </div>
      ))}

      {/* Comment input */}
      {showCommentInput && (
        <div className='border-y border-border bg-muted/50 px-4 py-3 ml-16'>
          <CommentInput
            filePath={filePath}
            lineRange={commentRange}
            onCancel={onCancelComment}
            onSubmit={onCommentSaved}
            originalCode={extractOriginalCode(file, commentRange) || undefined}
          />
        </div>
      )}
    </>
  );

  if (isInlineSafe) {
    // The semantic Tag is the positioned container; gutter lives inside it.
    return (
      <GutterNestingContext.Provider value={true}>
        <Tag
          className={blockClassName}
          data-source-start-line={startLine}
          data-source-end-line={endLine}
          style={{ paddingLeft: '4rem' }}
          {...tagProps}
        >
          {gutter}
          {children}
        </Tag>
        {commentElements}
      </GutterNestingContext.Provider>
    );
  }

  // For tags that can't contain inline content (ul, ol, table) or void
  // elements (hr), wrap in a container <div> with the gutter alongside.
  return (
    <GutterNestingContext.Provider value={true}>
      <div
        className='rendered-block group/rendered-block relative'
        data-source-start-line={startLine}
        data-source-end-line={endLine}
        style={{ paddingLeft: '4rem' }}
      >
        {gutter}
        {isVoid ? (
          <Tag className={className} {...tagProps} />
        ) : (
          <Tag className={className} {...tagProps}>{children}</Tag>
        )}
      </div>
      {commentElements}
    </GutterNestingContext.Provider>
  );
}

// ===== Main Component =====

export interface RenderedMarkdownViewProps {
  file: DiffFile;
  commentRange: { start: number; end: number; side: 'old' | 'new' } | null;
  onCancelComment: () => void;
  onCommentSaved: () => void;
  onGutterMouseDown: (startLine: number, endLine: number) => void;
}

export default function RenderedMarkdownView({
  file,
  commentRange,
  onCancelComment,
  onCommentSaved,
  onGutterMouseDown,
}: RenderedMarkdownViewProps) {
  const content = useMemo(() => extractFileContent(file), [file]);
  const filePath = file.newPath || file.oldPath;

  const lineRange: LineRange | null = commentRange
    ? { side: commentRange.side, start: commentRange.start, end: commentRange.end }
    : null;

  // Factory for block-level renderers
  const createBlockRenderer = useCallback(
    (tag: keyof React.JSX.IntrinsicElements) => {
      return function BlockRenderer({ node, children, ...props }: React.HTMLAttributes<HTMLElement> & ExtraProps) {
        const startLine = node?.position?.start?.line;
        const endLine = node?.position?.end?.line;
        return (
          <BlockWrapper
            startLine={startLine}
            endLine={endLine}
            tag={tag}
            filePath={filePath}
            file={file}
            commentRange={lineRange}
            onGutterMouseDown={onGutterMouseDown}
            onCancelComment={onCancelComment}
            onCommentSaved={onCommentSaved}
            tagProps={props}
          >
            {children}
          </BlockWrapper>
        );
      };
    },
    [filePath, file, lineRange, onGutterMouseDown, onCancelComment, onCommentSaved]
  );

  // Code renderer with Prism highlighting + Mermaid support
  const CodeRenderer = useCallback(
    ({ className, children, node, ...props }: React.HTMLAttributes<HTMLElement> & ExtraProps) => {
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
      return <code className={className} {...props}>{children}</code>;
    },
    []
  );

  const components: Components = useMemo(() => ({
    p: createBlockRenderer('p'),
    h1: createBlockRenderer('h1'),
    h2: createBlockRenderer('h2'),
    h3: createBlockRenderer('h3'),
    h4: createBlockRenderer('h4'),
    h5: createBlockRenderer('h5'),
    h6: createBlockRenderer('h6'),
    ul: createBlockRenderer('ul'),
    ol: createBlockRenderer('ol'),
    li: createBlockRenderer('li'),
    blockquote: createBlockRenderer('blockquote'),
    pre: createBlockRenderer('pre'),
    table: createBlockRenderer('table'),
    hr: createBlockRenderer('hr'),
    details: createBlockRenderer('details'),
    code: CodeRenderer,
  }), [createBlockRenderer, CodeRenderer]);

  return (
    <div className='prose dark:prose-invert max-w-none p-4 rendered-markdown-view'>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkEmoji]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
