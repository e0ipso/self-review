import React, { useMemo, createContext, useContext } from 'react';
import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import type { Element } from 'hast';
import type { LineRange } from '@self-review/types';
import { useLocalization } from '../../localization/LocalizationContext';
import {
  rehypePassiveContent,
  localContentUrlTransform,
  parsePassiveHtml,
} from '../../utils/passive-content';
import { CommentGutterButton } from './CommentGutterButton';
import { MarkdownCode } from './MarkdownCode';
import { remarkEmoji } from '../../utils/remark-emoji';
import type { RenderedTextMode } from '../../utils/file-type-utils';

// ===== Nesting Context =====
// Tracks whether we're inside a block that already has a gutter wrapper,
// so nested elements (li inside ul, p inside blockquote) don't duplicate it.

const GutterNestingContext = createContext(false);

// Per-render block state goes through this context; component types live at module scope so a
// parent re-render never remounts the comment composer under a block.

export interface RenderedBlockContextValue {
  commentRange: LineRange | null;
  /** Maps a 1-based line of the rendered source text to its added line number. */
  resolveLine: (sourceLine: number) => number;
  onGutterMouseDown: (startLine: number, endLine: number) => void;
}

const RenderedBlockContext = createContext<RenderedBlockContextValue | null>(null);

function useRenderedBlockContext(): RenderedBlockContextValue {
  const value = useContext(RenderedBlockContext);
  if (!value) {
    throw new Error('Rendered blocks must be rendered inside RenderedMarkdownView');
  }
  return value;
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
  const { t, number } = useLocalization();
  const { commentRange, onGutterMouseDown } = useRenderedBlockContext();
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

  const rangeLabel =
    startLine === endLine ? `${number(startLine)}` : `${number(startLine)}-${number(endLine)}`;

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
      className='rendered-gutter absolute start-0 top-0 w-16 text-end pe-2 select-none cursor-pointer text-[11px] text-muted-foreground/70'
      style={{ lineHeight: 'inherit' }}
      onMouseDown={e => {
        e.preventDefault();
        e.stopPropagation();
        onGutterMouseDown(startLine, endLine);
      }}
    >
      <CommentGutterButton
        className='absolute start-0 top-0 h-[1lh] opacity-0 group-hover/rendered-block:opacity-100'
        label={
          startLine === endLine
            ? t('Comment on line {line}', { line: startLine })
            : t('Comment on lines {start} to {end}', { start: startLine, end: endLine })
        }
        onActivate={() => onGutterMouseDown(startLine, endLine)}
      />
      <span className='pointer-events-none'>{rangeLabel}</span>
    </GutterEl>
  );

  const selected =
    commentRange?.side === 'new' && commentRange.start <= endLine && commentRange.end >= startLine;
  const blockClassName = [
    className,
    'rendered-block group/rendered-block relative',
    selected ? 'bg-blue-100 dark:bg-blue-900/30' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (isInlineSafe) {
    // The semantic Tag is the positioned container; gutter lives inside it.
    return (
      <GutterNestingContext.Provider value={true}>
        <Tag
          className={blockClassName}
          data-source-start-line={startLine}
          data-source-end-line={endLine}
          style={{ paddingInlineStart: '4rem' }}
          {...tagProps}
        >
          {gutter}
          {children}
        </Tag>
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
        style={{ paddingInlineStart: '4rem' }}
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
    </GutterNestingContext.Provider>
  );
}

// One component per tag, created once, so identities are stable across renders.

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

function HtmlRenderedContent({ content }: { content: string }) {
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

/** Stable positioned elements retain native semantics, passive filtering and gutter anchors. */
export function PositionedTextContent({
  content,
  contentMode,
  context,
}: {
  content: string;
  contentMode: RenderedTextMode;
  context: RenderedBlockContextValue;
}) {
  return (
    <RenderedBlockContext.Provider value={context}>
      {contentMode === 'markdown' ? (
        <ReactMarkdown
          urlTransform={localContentUrlTransform}
          remarkPlugins={MARKDOWN_REMARK_PLUGINS}
          rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
          components={MARKDOWN_COMPONENTS}
        >
          {content}
        </ReactMarkdown>
      ) : (
        <HtmlRenderedContent content={content} />
      )}
    </RenderedBlockContext.Provider>
  );
}
