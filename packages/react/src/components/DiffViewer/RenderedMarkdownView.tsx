import React, { useMemo, useCallback, createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Components, ExtraProps } from 'react-markdown';
import { MessageSquarePlus } from 'lucide-react';
import Prism from 'prismjs';
import type { DiffFile, LineRange } from '@self-review/types';
import { useReview } from '../../context/ReviewContext';
import CommentInput from '../Comments/CommentInput';
import CommentDisplay from '../Comments/CommentDisplay';
import { extractOriginalCode } from './diff-utils';
import MermaidBlock from './MermaidBlock';
import { remarkEmoji } from '../../utils/remark-emoji';
import { parseFrontMatter } from '../../utils/front-matter';
import FrontMatterTable from './FrontMatterTable';
import type { RenderedTextMode } from '../../utils/file-type-utils';

// ===== Nesting Context =====
// Tracks whether we're inside a block that already has a gutter wrapper,
// so nested elements (li inside ul, p inside blockquote) don't duplicate it.

const GutterNestingContext = createContext(false);

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

// Tags that accept phrasing (inline) content — the Tag itself can be the
// positioned container with the gutter <span> inside. Tags NOT in this set
// (ul, ol, table, hr) need a wrapper <div> because they can't contain inline
// children directly.
const INLINE_SAFE_TAGS: ReadonlySet<string> = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'li', 'details',
]);

const HTML_VOID_TAGS: ReadonlySet<string> = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);

const HTML_BLOCK_TAGS: ReadonlySet<string> = new Set([
  'address', 'article', 'aside', 'blockquote', 'details', 'dialog', 'div', 'dl',
  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4',
  'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section',
  'table', 'ul',
]);

const HTML_CONTAINER_TAGS: ReadonlySet<string> = new Set([
  'article', 'aside', 'div', 'footer', 'header', 'main', 'nav', 'section',
]);

const HTML_SKIPPED_TAGS: ReadonlySet<string> = new Set([
  'base', 'embed', 'iframe', 'link', 'meta', 'object', 'script', 'style',
]);

const HTML_SKIPPED_ATTRIBUTES: ReadonlySet<string> = new Set([
  'href', 'src', 'srcdoc', 'srcset', 'style',
]);

interface HtmlToken {
  tagName: string;
  line: number;
  kind: 'open' | 'close';
  selfClosing: boolean;
}

interface HtmlLinePosition {
  startLine: number | undefined;
  endLine: number | undefined;
}

function getLineNumberAtIndex(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (content[i] === '\n') line++;
  }
  return line;
}

function getAddedLineNumber(contentLineNumber: number, lines: AddedFileLine[]): number {
  return lines[contentLineNumber - 1]?.lineNumber ?? contentLineNumber;
}

function tokenizeHtml(content: string, lines: AddedFileLine[]): HtmlToken[] {
  const tokens: HtmlToken[] = [];
  const tagPattern = /<\s*(\/)?\s*([a-zA-Z][\w:-]*)([\s\S]*?)>/g;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(content)) !== null) {
    const [, closingSlash, rawTagName, rawRest] = match;
    const tagName = rawTagName.toLowerCase();
    const kind = closingSlash ? 'close' : 'open';
    tokens.push({
      tagName,
      line: getAddedLineNumber(getLineNumberAtIndex(content, match.index), lines),
      kind,
      selfClosing: kind === 'open' && (HTML_VOID_TAGS.has(tagName) || /\/\s*$/.test(rawRest)),
    });
  }

  return tokens;
}

function createHtmlLineResolver(content: string, lines: AddedFileLine[]) {
  const tokens = tokenizeHtml(content, lines);
  let tokenCursor = 0;

  return (tagName: string): HtmlLinePosition => {
    const normalizedTagName = tagName.toLowerCase();
    const startTokenIndex = tokens.findIndex((token, index) =>
      index >= tokenCursor &&
      token.kind === 'open' &&
      token.tagName === normalizedTagName
    );

    if (startTokenIndex === -1) {
      return { startLine: undefined, endLine: undefined };
    }

    tokenCursor = startTokenIndex + 1;
    const startToken = tokens[startTokenIndex];
    let endLine = startToken.line;

    if (!startToken.selfClosing) {
      let depth = 0;
      for (let i = startTokenIndex; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.tagName !== normalizedTagName) continue;
        if (token.kind === 'open' && !token.selfClosing) {
          depth++;
        } else if (token.kind === 'close') {
          depth--;
          if (depth === 0) {
            endLine = token.line;
            break;
          }
        }
      }
    }

    return { startLine: startToken.line, endLine };
  };
}

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
  contentMode: RenderedTextMode;
  commentRange: { start: number; end: number; side: 'old' | 'new' } | null;
  onCancelComment: () => void;
  onCommentSaved: () => void;
  onGutterMouseDown: (startLine: number, endLine: number) => void;
}

interface HtmlRenderedContentProps {
  content: string;
  lines: AddedFileLine[];
  file: DiffFile;
  filePath: string;
  lineRange: LineRange | null;
  onGutterMouseDown: (startLine: number, endLine: number) => void;
  onCancelComment: () => void;
  onCommentSaved: () => void;
}

function getHtmlAttributeProps(element: Element): Record<string, unknown> {
  const props: Record<string, unknown> = {};

  for (const attribute of Array.from(element.attributes)) {
    const attributeName = attribute.name.toLowerCase();
    if (attributeName.startsWith('on') || HTML_SKIPPED_ATTRIBUTES.has(attributeName)) continue;
    if (attributeName === 'class') {
      props.className = attribute.value;
    } else if (attributeName === 'for') {
      props.htmlFor = attribute.value;
    } else {
      props[attribute.name] = attribute.value;
    }
  }

  return props;
}

function hasBlockElementChild(element: Element): boolean {
  return Array.from(element.children).some(child =>
    HTML_BLOCK_TAGS.has(child.tagName.toLowerCase())
  );
}

function shouldWrapHtmlElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  if (!HTML_BLOCK_TAGS.has(tagName)) return false;
  if (HTML_CONTAINER_TAGS.has(tagName) && hasBlockElementChild(element)) return false;
  return true;
}

function HtmlRenderedContent({
  content,
  lines,
  file,
  filePath,
  lineRange,
  onGutterMouseDown,
  onCancelComment,
  onCommentSaved,
}: HtmlRenderedContentProps) {
  const lineResolver = createHtmlLineResolver(content, lines);
  const document = useMemo(() => {
    const parser = new DOMParser();
    return parser.parseFromString(content, 'text/html');
  }, [content]);

  const renderNode = useCallback((
    node: Node,
    key: React.Key,
    insideWrappedBlock = false
  ): React.ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const element = node as Element;
    const tagName = element.tagName.toLowerCase() as keyof React.JSX.IntrinsicElements;
    if (HTML_SKIPPED_TAGS.has(tagName)) {
      return null;
    }

    const tagProps = getHtmlAttributeProps(element);
    const shouldWrap = !insideWrappedBlock && shouldWrapHtmlElement(element);
    const children = Array.from(element.childNodes).map((child, index) =>
      renderNode(child, index, insideWrappedBlock || shouldWrap)
    );

    if (shouldWrap) {
      const { startLine, endLine } = lineResolver(tagName);
      return (
        <BlockWrapper
          key={key}
          startLine={startLine}
          endLine={endLine}
          tag={tagName}
          filePath={filePath}
          file={file}
          commentRange={lineRange}
          onGutterMouseDown={onGutterMouseDown}
          onCancelComment={onCancelComment}
          onCommentSaved={onCommentSaved}
          tagProps={tagProps}
        >
          {children}
        </BlockWrapper>
      );
    }

    return React.createElement(
      tagName,
      { key, ...tagProps },
      HTML_VOID_TAGS.has(tagName) ? undefined : children
    );
  }, [file, filePath, lineRange, lineResolver, onCancelComment, onCommentSaved, onGutterMouseDown]);

  return <>{Array.from(document.body.childNodes).map((node, index) => renderNode(node, index))}</>;
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
    () => contentMode === 'markdown' ? parseFrontMatter(content) : null,
    [content, contentMode]
  );
  const markdownBody = frontMatter ? frontMatter.body : content;
  const lineOffset = frontMatter ? frontMatter.lineOffset : 0;
  const filePath = file.newPath || file.oldPath;

  const lineRange: LineRange | null = commentRange
    ? { side: commentRange.side, start: commentRange.start, end: commentRange.end }
    : null;

  // Factory for block-level renderers
  const createBlockRenderer = useCallback(
    (tag: keyof React.JSX.IntrinsicElements) => {
      return function BlockRenderer({ node, children, ...props }: React.HTMLAttributes<HTMLElement> & ExtraProps) {
        const startLine = node?.position?.start?.line !== undefined ? node.position.start.line + lineOffset : undefined;
        const endLine = node?.position?.end?.line !== undefined ? node.position.end.line + lineOffset : undefined;
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
    [filePath, file, lineRange, lineOffset, onGutterMouseDown, onCancelComment, onCommentSaved]
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
    <div
      className='prose dark:prose-invert max-w-none p-4 rendered-markdown-view'
      data-rendered-text-mode={contentMode}
    >
      {frontMatter && <FrontMatterTable metadata={frontMatter.metadata} />}
      {contentMode === 'markdown' ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkEmoji]}
          rehypePlugins={[rehypeRaw]}
          components={components}
        >
          {markdownBody}
        </ReactMarkdown>
      ) : (
        <HtmlRenderedContent
          content={content}
          lines={addedLines}
          file={file}
          filePath={filePath}
          lineRange={lineRange}
          onGutterMouseDown={onGutterMouseDown}
          onCancelComment={onCancelComment}
          onCommentSaved={onCommentSaved}
        />
      )}
    </div>
  );
}
