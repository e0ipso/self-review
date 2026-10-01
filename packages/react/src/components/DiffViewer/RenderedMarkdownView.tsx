import React, { useMemo, createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import type { Element } from 'hast';
import {
  rehypePassiveContent,
  localContentUrlTransform,
  parsePassiveHtml,
} from '../../utils/passive-content';
import type { Components, ExtraProps } from 'react-markdown';
import { MessageSquarePlus } from 'lucide-react';
import type { DiffFile, LineRange } from '@self-review/types';
import { useReview } from '../../context/ReviewContext';
import CommentInput from '../Comments/CommentInput';
import CommentDisplay from '../Comments/CommentDisplay';
import { extractOriginalCode } from './diff-utils';
import { MarkdownCode } from './MarkdownCode';
import { remarkEmoji } from '../../utils/remark-emoji';
import { parseFrontMatter } from '../../utils/front-matter';
import FrontMatterTable from './FrontMatterTable';
import type { RenderedTextMode } from '../../utils/file-type-utils';

// ===== Nesting Context =====
// Tracks whether we're inside a block that already has a gutter wrapper,
// so nested elements (li inside ul, p inside blockquote) don't duplicate it.

const GutterNestingContext = createContext(false);

// ===== Rendered Block Context =====
// Everything a block needs that changes between renders travels through this
// context. The block component types themselves are created once at module
// scope, so a parent re-render never gives react-markdown a new component
// identity and never remounts the comment composer under a block.

interface RenderedBlockContextValue {
  file: DiffFile;
  filePath: string;
  commentRange: LineRange | null;
  /** Maps a 1-based line of the rendered source text to its added line number. */
  resolveLine: (sourceLine: number) => number;
  onGutterMouseDown: (startLine: number, endLine: number) => void;
  onCancelComment: () => void;
  onCommentSaved: () => void;
}

const RenderedBlockContext = createContext<RenderedBlockContextValue | null>(null);

function useRenderedBlockContext(): RenderedBlockContextValue {
  const value = useContext(RenderedBlockContext);
  if (!value) {
    throw new Error('Rendered blocks must be rendered inside RenderedMarkdownView');
  }
  return value;
}

// ===== Content Extraction =====

interface AddedFileLine {
  lineNumber: number;
  content: string;
}

function extractAddedFileLines(file: DiffFile): AddedFileLine[] {
  const lines: AddedFileLine[] = [];
  let fallbackLineNumber = 1;

  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type !== 'addition') continue;

      const lineNumber = line.newLineNumber ?? fallbackLineNumber;
      lines.push({ lineNumber, content: line.content });
      fallbackLineNumber = lineNumber + 1;
    }
  }

  return lines;
}

function extractFileContent(lines: AddedFileLine[]): string {
  return lines.map(line => line.content).join('\n');
}

function getAddedLineNumber(contentLineNumber: number, lines: AddedFileLine[]): number {
  return lines[contentLineNumber - 1]?.lineNumber ?? contentLineNumber;
}

// Tags that accept phrasing (inline) content — the Tag itself can be the
// positioned container with the gutter <span> inside. Tags NOT in this set
// (ul, ol, table, hr) need a wrapper <div> because they can't contain inline
// children directly.
const INLINE_SAFE_TAGS: ReadonlySet<string> = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'li',
  'details',
]);

const HTML_VOID_TAGS: ReadonlySet<string> = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

type BlockTag = keyof React.JSX.IntrinsicElements;

// Block-level Markdown output that gets its own gutter row.
const MARKDOWN_BLOCK_TAGS = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'table',
  'hr',
  'details',
] as const satisfies readonly BlockTag[];

// Block-level HTML elements that get their own gutter row in a rendered HTML
// file. Containers (see below) only do when they hold no block children.
const HTML_BLOCK_TAGS = [
  'address',
  'article',
  'aside',
  'blockquote',
  'details',
  'div',
  'dl',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'ul',
] as const satisfies readonly BlockTag[];

const HTML_BLOCK_TAG_SET: ReadonlySet<string> = new Set(HTML_BLOCK_TAGS);

const HTML_CONTAINER_TAGS: ReadonlySet<string> = new Set([
  'article',
  'aside',
  'div',
  'footer',
  'header',
  'main',
  'nav',
  'section',
]);

function hasBlockElementChild(element: Element): boolean {
  return element.children.some(
    child => child.type === 'element' && HTML_BLOCK_TAG_SET.has(child.tagName)
  );
}

// ===== Block Wrapper with Gutter =====

interface BlockWrapperProps {
  startLine: number | undefined;
  endLine: number | undefined;
  children: React.ReactNode;
  tag: BlockTag;
  className?: string;
  tagProps?: Record<string, unknown>;
}

function BlockWrapper({
  startLine,
  endLine,
  children,
  tag: Tag,
  className,
  tagProps,
}: BlockWrapperProps) {
  const { getCommentsForFile } = useReview();
  const { file, filePath, commentRange, onGutterMouseDown, onCancelComment, onCommentSaved } =
    useRenderedBlockContext();
  const isNested = useContext(GutterNestingContext);

  // If nested inside another gutter-wrapped block, or no position data,
  // render the tag directly without a gutter row.
  if (isNested || startLine === undefined || endLine === undefined) {
    return (
      <Tag className={className} {...tagProps}>
        {children}
      </Tag>
    );
  }

  const rangeLabel = startLine === endLine ? `${startLine}` : `${startLine}-${endLine}`;

  // Find comments overlapping this block's range
  const blockComments = getCommentsForFile(filePath).filter(c => {
    if (!c.lineRange || c.lineRange.side !== 'new') return false;
    return c.lineRange.start <= endLine && c.lineRange.end >= startLine;
  });

  // Show comment input below this block if the comment range ends within this block
  const showCommentInput =
    commentRange &&
    commentRange.side === 'new' &&
    commentRange.end >= startLine &&
    commentRange.end <= endLine;

  // Void elements (hr, img, etc.) can't have children
  const isVoid = HTML_VOID_TAGS.has(Tag as string);

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
      {blockComments.map(comment => {
        const visibleCode = comment.lineRange
          ? extractOriginalCode(file, comment.lineRange)
          : undefined;
        return (
          <div key={comment.id} className='border-y border-border bg-muted/50 px-4 py-3 ml-16'>
            <CommentDisplay
              comment={comment}
              originalCode={visibleCode}
              anchorFullyVisible={comment.lineRange === null || visibleCode !== undefined}
            />
          </div>
        );
      })}

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
          <Tag className={className} {...tagProps}>
            {children}
          </Tag>
        )}
      </div>
      {commentElements}
    </GutterNestingContext.Provider>
  );
}

// ===== Stable Block Components =====
// One component per tag, created once. Positions come from the hast node the
// renderer passes in (`passNode`), and everything else from the context, so
// these types are identical across renders and React keeps their subtrees.

type RenderedBlockProps = React.HTMLAttributes<HTMLElement> & ExtraProps;

function createRenderedBlock(tag: BlockTag, deferToBlockChildren = false) {
  function RenderedBlock({ node, children, ...props }: RenderedBlockProps) {
    const { resolveLine } = useRenderedBlockContext();
    const position = node?.position;
    const positioned =
      position !== undefined && !(deferToBlockChildren && node && hasBlockElementChild(node));
    const startLine = positioned ? resolveLine(position.start.line) : undefined;
    const endLine = positioned ? resolveLine(position.end.line) : undefined;

    return (
      <BlockWrapper startLine={startLine} endLine={endLine} tag={tag} tagProps={props}>
        {children}
      </BlockWrapper>
    );
  }
  RenderedBlock.displayName = `RenderedBlock(${tag})`;
  return RenderedBlock;
}

function createBlockComponents(
  tags: readonly BlockTag[],
  deferToBlockChildren: ReadonlySet<string> = new Set()
): Components {
  const components: Record<string, React.ComponentType<RenderedBlockProps>> = {};
  for (const tag of tags) {
    components[tag] = createRenderedBlock(tag, deferToBlockChildren.has(tag));
  }
  return components as Components;
}

const MARKDOWN_COMPONENTS: Components = {
  ...createBlockComponents(MARKDOWN_BLOCK_TAGS),
  code: MarkdownCode,
};

const HTML_COMPONENTS: Components = createBlockComponents(HTML_BLOCK_TAGS, HTML_CONTAINER_TAGS);

const MARKDOWN_REMARK_PLUGINS = [remarkGfm, remarkEmoji];
const MARKDOWN_REHYPE_PLUGINS = [rehypeRaw, rehypePassiveContent];

// ===== Main Component =====

export interface RenderedMarkdownViewProps {
  file: DiffFile;
  contentMode: RenderedTextMode;
  commentRange: { start: number; end: number; side: 'old' | 'new' } | null;
  onCancelComment: () => void;
  onCommentSaved: () => void;
  onGutterMouseDown: (startLine: number, endLine: number) => void;
}

function HtmlRenderedContent({ content }: { content: string }) {
  // The parsed, filtered tree carries the parser's own source positions, so
  // every block anchors to the lines of the markup it came from.
  return useMemo(
    () =>
      toJsxRuntime(parsePassiveHtml(content), {
        Fragment,
        jsx,
        jsxs,
        components: HTML_COMPONENTS,
        ignoreInvalidStyle: true,
        passKeys: true,
        passNode: true,
      }),
    [content]
  );
}

export default function RenderedMarkdownView({
  file,
  contentMode,
  commentRange,
  onCancelComment,
  onCommentSaved,
  onGutterMouseDown,
}: RenderedMarkdownViewProps) {
  const addedLines = useMemo(() => extractAddedFileLines(file), [file]);
  const content = useMemo(() => extractFileContent(addedLines), [addedLines]);
  const frontMatter = useMemo(
    () => (contentMode === 'markdown' ? parseFrontMatter(content) : null),
    [content, contentMode]
  );
  const markdownBody = frontMatter ? frontMatter.body : content;
  const lineOffset = frontMatter ? frontMatter.lineOffset : 0;
  const filePath = file.newPath || file.oldPath;

  const resolveLine = useMemo(
    () => (sourceLine: number) => getAddedLineNumber(sourceLine + lineOffset, addedLines),
    [addedLines, lineOffset]
  );

  const blockContext = useMemo<RenderedBlockContextValue>(
    () => ({
      file,
      filePath,
      commentRange,
      resolveLine,
      onGutterMouseDown,
      onCancelComment,
      onCommentSaved,
    }),
    [file, filePath, commentRange, resolveLine, onGutterMouseDown, onCancelComment, onCommentSaved]
  );

  return (
    <RenderedBlockContext.Provider value={blockContext}>
      <div
        className='prose dark:prose-invert max-w-none p-4 rendered-markdown-view'
        data-rendered-text-mode={contentMode}
      >
        {frontMatter && <FrontMatterTable metadata={frontMatter.metadata} />}
        {contentMode === 'markdown' ? (
          <ReactMarkdown
            urlTransform={localContentUrlTransform}
            remarkPlugins={MARKDOWN_REMARK_PLUGINS}
            rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
            components={MARKDOWN_COMPONENTS}
          >
            {markdownBody}
          </ReactMarkdown>
        ) : (
          <HtmlRenderedContent content={content} />
        )}
      </div>
    </RenderedBlockContext.Provider>
  );
}
