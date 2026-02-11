---
id: 5
group: "comment-ui"
dependencies: []
status: "pending"
created: "2026-02-11"
skills:
  - react-components
---
# Add Markdown Rendering to CommentDisplay

## Objective
Render comment bodies as GitHub-flavored markdown (GFM) instead of plain text. Install `react-markdown` and `remark-gfm` as dependencies. Replace the current `whitespace-pre-wrap` plain text rendering with a ReactMarkdown component. Apply scoped prose-like styling for consistent appearance with the app's theme.

## Skills Required
- `react-components`: Installing npm packages, React component integration, CSS scoping

## Acceptance Criteria
- [ ] `react-markdown` and `remark-gfm` are installed as dependencies
- [ ] Comment bodies render as GFM (bold, italic, code, fenced code blocks, tables, task lists, strikethrough, autolinks)
- [ ] Markdown styles are scoped within the comment body and don't leak to the rest of the app
- [ ] Plain text comments still render correctly (no regression for simple text)
- [ ] Code blocks in markdown are styled with monospace font and background
- [ ] Dark and light themes both render markdown readably
- [ ] The comment input (`CommentInput`) remains a plain `<Textarea>` — no changes there

## Technical Requirements
- Run `npm install react-markdown remark-gfm` to add dependencies
- Modify `src/renderer/components/Comments/CommentDisplay.tsx`
- Add scoped markdown styles (Tailwind `prose` class or custom CSS)

## Input Dependencies
None — independent change to CommentDisplay.

## Output Artifacts
- Updated `package.json` with new dependencies
- Updated `CommentDisplay.tsx` with ReactMarkdown rendering

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Install dependencies

```bash
npm install react-markdown remark-gfm
```

### CommentDisplay.tsx changes

1. **Add imports**:
```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
```

2. **Replace plain text rendering** (around line 97-99):

```tsx
// REMOVE:
<div className="px-3 pb-3 whitespace-pre-wrap text-sm text-foreground leading-relaxed">
  {comment.body}
</div>

// ADD:
<div className="px-3 pb-3 text-sm text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-2 prose-headings:my-2 prose-code:text-[0.85em] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-muted prose-pre:bg-muted prose-pre:rounded-md">
  <ReactMarkdown remarkPlugins={[remarkGfm]}>
    {comment.body}
  </ReactMarkdown>
</div>
```

### Styling notes

- Use Tailwind's `prose` / `prose-sm` / `dark:prose-invert` classes for automatic typography
- Add `max-w-none` to prevent prose from adding a max-width constraint
- Override specific prose spacing to keep comments compact (my-1, my-0.5 for lists)
- The `prose-code` overrides ensure inline code has a background and padding matching the app's design
- `prose-pre` overrides style fenced code blocks

If `@tailwindcss/typography` is not installed, install it:
```bash
npm install -D @tailwindcss/typography
```
And add it to the Tailwind config plugins array. Check `tailwind.config.js` first to see if it's already included.

### Alternative without @tailwindcss/typography

If installing the typography plugin is undesirable, apply custom styles directly:

```tsx
<div className="px-3 pb-3 text-sm text-foreground leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_pre]:my-2 [&_pre]:p-3 [&_pre]:bg-muted [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_code]:text-[0.85em] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-muted [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-semibold [&_h3]:font-medium [&_a]:text-blue-600 [&_a]:underline [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground">
  <ReactMarkdown remarkPlugins={[remarkGfm]}>
    {comment.body}
  </ReactMarkdown>
</div>
```

This approach uses Tailwind's arbitrary variant selectors to style markdown output without the typography plugin.

### Security note

`react-markdown` renders React elements (not raw HTML via dangerouslySetInnerHTML), so XSS risk is minimal. The app is local-only with no external input. No additional sanitization needed.

</details>
