---
id: 5
group: "react-previews"
dependencies: []
status: "completed"
created: 2026-10-01
skills:
  - react
  - typescript
complexity_score: 5
execution_profile: "standard-implementation"
---
# Contain preview failures, use safe file lookup, and bound front matter (R10, A8)

## Objective
A single file's preview can never blank the review: file lookups work for any valid filename, every file preview is wrapped by an error boundary that leaves navigation and Finish/save controls usable, and front-matter formatting detects cycles and enforces depth/node budgets with a safe fallback.

## Skills Required
React (refs, error boundaries, effects) and TypeScript.

## Acceptance Criteria
- [x] No DOM lookup interpolates a file path into a CSS selector unescaped: `DiffNavigationContext.tsx:39`, `DiffViewer.tsx:95`, `FileSection.tsx:124–128` (and any other `querySelector(\`[data-...="${path}"]\`)` found by grep) use scoped element refs/registries or `CSS.escape`. Files whose names contain `"`, `\`, `]`, newline and spaces can be navigated to, expanded and marked viewed (including from the effect path) without exceptions.
- [x] A reusable `PreviewErrorBoundary` (class component) wraps each file's body/preview; a throwing preview renders a contained error message with the file path while other files, the file tree, toolbar and Finish controls stay interactive. It resets when the file/content changes.
- [x] `packages/react/src/utils/front-matter.ts` / `FrontMatterTable.tsx` detect cycles (WeakSet of visited objects) and enforce finite depth and total node budgets (e.g. depth 16, 2,000 nodes — choose and document constants); the 33-byte input `---\nloop: &loop [*loop]\n---\nhello` renders a fallback (raw front-matter text or a "front matter too complex to display" notice) and the Markdown body still renders.
- [x] Tests (jsdom, `packages/react/src/**/*.test.tsx`): quoted/backslash/newline filename navigation and viewed toggling; a deliberately throwing preview leaves another file and the Finish button rendered and clickable; cyclic and deeply nested front matter fall back. `npm run test:unit` passes.
- [x] `npm run test:e2e` (webapp) passes.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `packages/react/src/context/DiffNavigationContext.tsx`, `packages/react/src/components/DiffViewer/DiffViewer.tsx`, `FileSection.tsx` (lookup + boundary placement only), `FileSectionBody.tsx` or `DiffContentArea.tsx` (boundary placement), new `packages/react/src/components/DiffViewer/PreviewErrorBoundary.tsx`, `packages/react/src/utils/front-matter.ts`, `FrontMatterTable.tsx`.
- Use shadcn/ui primitives for the fallback UI (e.g. an alert-style div consistent with existing error displays).

## Input Dependencies
None.

## Output Artifacts
`PreviewErrorBoundary` and safe lookup helpers (task 9 reworks lazy loading in the same `FileSection.tsx`; task 12 relies on the boundary for Mermaid failures).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` R10 and `docs/security-audit-2026-10-01.md` A8; reproduce with `docs/codebase-audit-2026-10-01/ui.probe.test.tsx` (selector case) first.
2. Prefer a ref registry: `DiffNavigationContext` exposes `registerFileElement(path, el)`; `FileSection` registers its root via a callback ref; navigation looks up the Map. Fallback `CSS.escape` is acceptable where a registry is awkward (jsdom supports `CSS.escape` only via polyfill — check; if missing, write a tiny escape helper per CSSOM spec and unit test it).
3. Error boundary: `componentDidCatch` logs via `console.error`; `getDerivedStateFromError`; `resetKeys` prop compare in `componentDidUpdate`.
4. Front matter: format recursively with `(value, depth, budget)`; on exceeding, throw a sentinel caught by the formatter wrapper returning `{ ok: false }` so the table renders the fallback — don't rely on the boundary for this expected case.
5. Concurrency: tasks 6 (ReviewContext/SingleFileReview) and 7 (comments/FileTree) run in parallel; task 2 may upgrade dependencies. Edit only listed files; re-read before editing; never revert others' work or the unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration (render real components in jsdom). Test edge cases and failure containment; no tests for React itself.
</details>
