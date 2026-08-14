---
id: 2
group: "frontmatter-rendering"
dependencies: [1]
status: "completed"
created: 2026-03-26
skills:
  - react
  - typescript
---
# Integrate Front Matter Rendering into RenderedMarkdownView

## Objective
Wire the `parseFrontMatter` utility and `FrontMatterTable` component into the existing `RenderedMarkdownView` rendering pipeline, including the critical line offset adjustment for gutter numbers.

## Skills Required
- React component integration
- Understanding of react-markdown AST position system

## Acceptance Criteria
- [ ] `RenderedMarkdownView` calls `parseFrontMatter()` on extracted content
- [ ] When front matter exists, `FrontMatterTable` renders above `<ReactMarkdown>`
- [ ] Stripped `body` (not full content) is passed to `<ReactMarkdown>`
- [ ] Gutter line numbers are adjusted by `lineOffset` so they map to correct source diff lines
- [ ] The `createBlockRenderer` uses adjusted line numbers (startLine + lineOffset, endLine + lineOffset)
- [ ] Files without front matter render identically to current behavior (no regression)
- [ ] Malformed YAML front matter falls back to rendering full content as-is

## Technical Requirements
- Modify `packages/react/src/components/DiffViewer/RenderedMarkdownView.tsx`
- After `extractFileContent()`, call `parseFrontMatter()` on the result
- If front matter is detected: render `<FrontMatterTable metadata={...} />` above `<ReactMarkdown>` inside the existing `.prose` wrapper div
- Pass the stripped `body` to `<ReactMarkdown>` instead of full `content`
- In `createBlockRenderer`, adjust `node.position.start.line` and `node.position.end.line` by adding `lineOffset` before passing to `BlockWrapper`
- The offset is 0 when no front matter exists, so the no-front-matter path is a no-op

## Input Dependencies
- Task 1: `parseFrontMatter` utility and `FrontMatterTable` component

## Output Artifacts
- Modified `packages/react/src/components/DiffViewer/RenderedMarkdownView.tsx`

## Implementation Notes
- The line offset adjustment is the most critical correctness concern. The `startLine` and `endLine` from `node.position` refer to the stripped body, but `BlockWrapper` needs source-line numbers that map to the original diff. Adding `lineOffset` bridges this gap.
- Keep the integration minimal — avoid restructuring RenderedMarkdownView beyond what's necessary.
