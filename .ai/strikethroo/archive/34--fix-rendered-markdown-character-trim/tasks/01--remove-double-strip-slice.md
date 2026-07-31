---
id: 1
group: "bug-fix"
dependencies: []
status: "completed"
created: "2026-03-09"
skills:
  - typescript
---
# Remove Erroneous `.slice(1)` from extractFileContent

## Objective

Remove the double-strip regression introduced in commit `a80e2b9` by deleting the `.slice(1)` call on `line.content` in both copies of `RenderedMarkdownView.tsx`. The diff parser already strips the diff prefix character (`+`, `-`, ` `) before storing `DiffLine.content`, so calling `.slice(1)` on top of that silently removes the first real character of every rendered markdown line.

## Skills Required

- **typescript**: Edit two TypeScript/React source files

## Acceptance Criteria

- [ ] `src/renderer/components/DiffViewer/RenderedMarkdownView.tsx` uses `line.content` (not `line.content.slice(1)`) in `extractFileContent`
- [ ] `packages/react/src/components/DiffViewer/RenderedMarkdownView.tsx` uses `line.content` (not `line.content.slice(1)`) in `extractFileContent`
- [ ] All existing unit tests pass (`npm run test:unit`)
- [ ] No `+` prefix characters appear as markdown list markers in rendered view (verified by code inspection — the diff parser guarantees prefix-free content)

## Technical Requirements

- TypeScript / React
- Vitest unit test suite

## Input Dependencies

None — this is a self-contained revert of a single bad line in two files.

## Output Artifacts

- Two patched `RenderedMarkdownView.tsx` files (renderer + packages/react)

## Implementation Notes

<details>
<summary>Step-by-step instructions</summary>

### File 1: `src/renderer/components/DiffViewer/RenderedMarkdownView.tsx`

Find the `extractFileContent` function (around line 25–30). It contains a line like:

```ts
.map(line => line.content.slice(1))
```

Change it to:

```ts
.map(line => line.content)
```

### File 2: `packages/react/src/components/DiffViewer/RenderedMarkdownView.tsx`

Same change — find `.map(line => line.content.slice(1))` and change to `.map(line => line.content)`.

### Why this is safe

`DiffLine.content` is already prefix-free. In `packages/core/src/diff-parser.ts` (lines 140, 149, 158), the parser calls `line.substring(1)` before assigning to `content`. Every consumer of `DiffLine.content` receives text with no leading `+`/`-`/` ` character. The `.slice(1)` added in `a80e2b9` was based on an incorrect assumption.

### Verification

Run the unit tests to confirm nothing regresses:

```bash
npm run test:unit
```

No new tests need to be written — the existing diff-parser tests already assert that `content` is prefix-free.

</details>
