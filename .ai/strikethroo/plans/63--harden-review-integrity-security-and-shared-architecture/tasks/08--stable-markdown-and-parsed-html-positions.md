---
id: 8
group: "react-previews"
dependencies: [2]
status: "pending"
created: 2026-10-01
skills:
  - react
  - html-parsing
complexity_score: 6
complexity_notes: "Two coupled changes in RenderedMarkdownView: stable component identities and replacing the regex HTML tokenizer with parser positions that survive passive-content filtering."
execution_profile: "complex-architecture"
---
# Stabilize rendered Markdown components and derive HTML anchors from a real parse (R08, R09)

## Objective
Comment drafts in rendered Markdown survive unrelated review updates because block component types are stable, and rendered HTML comment anchors come from actual HTML parser source positions that survive passive-content filtering, replacing the regex tokenizer.

## Skills Required
React component identity/memoization and HTML parsing with source positions (hast/parse5).

## Acceptance Criteria
- [ ] Markdown block components passed to `react-markdown` are module-level (or once-memoized) stable types; per-render data (line ranges, comment actions, active composer) flows through React context or `node.position` data, not new closures in a component factory (`RenderedMarkdownView.tsx:538`, `FileSection.tsx:207–208`, `DiffContentArea.tsx:118`).
- [ ] Test: type `unsaved draft` in a rendered-Markdown comment composer, then mark another file viewed, add another comment elsewhere, and change theme — the draft text remains (jsdom).
- [ ] The regex HTML tokenizer (`RenderedMarkdownView.tsx:182–219`) is deleted; positions come from a real parse (e.g. `hast-util-from-html`/`rehype-parse`/`parse5` with location info) declared as an explicit dependency of `@self-review/react` in its `package.json` (not relied on transitively).
- [ ] Positions survive passive-content filtering (`packages/react/src/utils/passive-content.ts`) and rendering: comments on `<!-- <p>fake</p> -->\n<p>actual</p>` anchor to line 2; nested blocks/blockquotes, dropped `<form>`/`<script>`/`<template>` content, and repeated identical tags each anchor to their own source lines. Table-driven tests assert exact `newLineStart/newLineEnd`.
- [ ] No active elements/event handlers are reintroduced, CSP is not widened, and existing passive-content tests pass.
- [ ] `npm run test:unit`, `npm run typecheck:packages`, `npm run build:packages`, and `npm run test:e2e` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `packages/react/src/components/DiffViewer/RenderedMarkdownView.tsx`, `FileSection.tsx`/`DiffContentArea.tsx` only where they create per-render component props, `packages/react/src/utils/passive-content.ts`, `packages/react/package.json`, `package-lock.json`.
- Keep the browser-only rule: no Node imports in React.

## Input Dependencies
Task 2 (lockfile settled before adding a dependency).

## Output Artifacts
Stable Markdown rendering and parser-based HTML mapping (task 12 then isolates Mermaid and passive layout in the same rendering path).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` R08/R09 and `docs/codebase-audit-2026-10-01/ui.probe.test.tsx`; reproduce both failures first (RED).
2. Check what's already in the lockfile: `npm ls hast-util-from-html rehype-parse rehype-raw parse5 hast-util-raw`. `react-markdown` + `rehype-raw` already give hast nodes with `position` for Markdown; for the HTML-file path, parse the whole HTML file with a positioned parser, filter passive content on the hast tree (preserving `position`), then render. If passive-content currently operates on DOM/strings, adapt it to hast or carry `data-sr-line-start/end` attributes from parse positions through filtering.
3. Stable components: define `const components = { p: MarkdownBlock, h1: MarkdownBlock, ... }` at module scope where `MarkdownBlock` reads `node.position` and a `RenderedCommentContext` value (memoized with the stable callbacks) — not closures over ranges.
4. Install the dependency with `npm install <pkg> -w @self-review/react` (check the workspace name in `packages/react/package.json`).
5. Concurrency: task 3 (core XML + a small React warning) and task 9 (`FileSection.tsx`/`DiffViewer.tsx` lazy loading) run in the same phase. Keep `FileSection.tsx` edits limited to the component-props creation lines; re-read before editing; never revert others' work or unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration (render real HTML/Markdown in jsdom and assert anchors). Test edge cases; do not test the parser library itself.
</details>
