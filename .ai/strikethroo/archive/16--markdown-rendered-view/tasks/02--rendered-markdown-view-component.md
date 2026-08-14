---
id: 2
group: "rendered-markdown-view"
dependencies: [1]
status: "completed"
created: "2026-02-18"
skills: ["react-components", "typescript"]
---

# Create RenderedMarkdownView Component with Source-Line-Mapped Blocks

## Objective

Build the core `RenderedMarkdownView` component that renders markdown content using `react-markdown` with custom block-level renderers. Each rendered block must be annotated with `data-source-start-line` and `data-source-end-line` attributes derived from the markdown AST positions. Apply `prose` styling from `@tailwindcss/typography` with dark mode support. Include Prism.js syntax highlighting for code blocks.

## Skills Required

React component development with TypeScript. Understanding of `react-markdown` custom component renderers and the `unified`/`remark` AST position system.

## Acceptance Criteria

- [ ] New file `src/renderer/components/DiffViewer/RenderedMarkdownView.tsx` exists
- [ ] Component accepts a `DiffFile` prop and extracts full file content from hunks (concatenating addition line content)
- [ ] `react-markdown` renders the extracted content with `remark-gfm` plugin
- [ ] Custom block-level renderers (`p`, `h1`-`h6`, `ul`, `ol`, `blockquote`, `pre`, `table`, `hr`) wrap output in a container with `data-source-start-line` and `data-source-end-line` attributes from `node.position`
- [ ] Rendered output is styled with Tailwind `prose dark:prose-invert` classes
- [ ] Code blocks use Prism.js for syntax highlighting (reusing patterns from `SyntaxLine.tsx`)
- [ ] The component renders correctly for a basic markdown file with headings, paragraphs, lists, code blocks, and tables

## Technical Requirements

- **Content extraction**: Iterate through `file.hunks[*].lines` where `line.type === 'addition'`, extract `line.content`. The `DiffLine.content` field contains the raw line content (the `+` prefix is already stripped by the diff parser — verify by checking the `DiffLine` type and existing usage in `UnifiedView`).
- **react-markdown custom renderers**: `react-markdown` passes a `node` prop to custom components. The node has `position.start.line` and `position.end.line` from the original markdown source. Use these to set `data-source-start-line` and `data-source-end-line` on wrapper elements.
- **Prism.js integration**: The project uses Prism.js via `SyntaxLine.tsx`. For code blocks in the rendered view, use `Prism.highlight()` directly on the code string with the detected language.
- **Styling**: Use `@tailwindcss/typography` prose classes. The rendered area should look clean in both light and dark modes.

## Input Dependencies

Task 1 (dependencies installed: `react-markdown`, `remark-gfm`, `@tailwindcss/typography`).

## Output Artifacts

- `src/renderer/components/DiffViewer/RenderedMarkdownView.tsx` — the core component
- Exported and ready to be imported by `FileSection.tsx` (task 5)

## Implementation Notes

<details>

### File content extraction

```typescript
function extractFileContent(file: DiffFile): string {
  return file.hunks
    .flatMap(hunk => hunk.lines)
    .filter(line => line.type === 'addition')
    .map(line => line.content)
    .join('\n');
}
```

Verify how `DiffLine.content` works by reading `src/main/diff-parser.ts` — check if the `+` prefix is included or stripped. Also check `UnifiedView.tsx` to see how it accesses line content.

### react-markdown custom renderers

```typescript
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Custom renderer wrapper that annotates blocks with source positions
function createBlockRenderer(Tag: string) {
  return function BlockRenderer({ node, children, ...props }: any) {
    const startLine = node?.position?.start?.line;
    const endLine = node?.position?.end?.line;
    return (
      <Tag
        {...props}
        data-source-start-line={startLine}
        data-source-end-line={endLine}
      >
        {children}
      </Tag>
    );
  };
}
```

Apply this pattern to all block-level elements: `p`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `ul`, `ol`, `blockquote`, `pre`, `table`, `hr`.

For `li` elements — annotate them too since they have their own positions, which enables per-list-item commenting.

### Code block syntax highlighting with Prism

For the `code` renderer inside `pre` blocks, detect the language from the className (react-markdown passes `className: "language-xxx"`), then use Prism to highlight:

```typescript
import Prism from 'prismjs';

function CodeRenderer({ className, children, ...props }: any) {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  if (lang && Prism.languages[lang]) {
    const html = Prism.highlight(code, Prism.languages[lang], lang);
    return <code className={className} dangerouslySetInnerHTML={{ __html: html }} {...props} />;
  }
  return <code className={className} {...props}>{children}</code>;
}
```

### Prose styling

Wrap the entire rendered output in a div with: `className="prose dark:prose-invert max-w-none"`. The `max-w-none` prevents the default prose max-width constraint.

### Component signature

```typescript
interface RenderedMarkdownViewProps {
  file: DiffFile;
}

export default function RenderedMarkdownView({ file }: RenderedMarkdownViewProps) {
  const content = useMemo(() => extractFileContent(file), [file]);

  return (
    <div className="prose dark:prose-invert max-w-none p-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: createBlockRenderer('p'),
          h1: createBlockRenderer('h1'),
          // ... etc for all block elements
          code: CodeRenderer,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

### Important: Check DiffLine.content format

Read `src/main/diff-parser.ts` to verify whether `line.content` includes the leading `+`/`-`/` ` character or not. If it does include it, you'll need to strip the first character for addition lines when extracting content. Also check `UnifiedView.tsx` to see how it handles this — it likely has a precedent.

</details>
