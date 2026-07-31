---
id: 1
group: "test-infrastructure"
dependencies: []
status: "completed"
created: "2026-03-05"
skills:
  - typescript
  - react-components
---
# Fixture Data Extensions and Webapp Harness Updates

## Objective
Add `createEmptyPayload()` and `createMarkdownPayload()` factory functions to `tests/webapp/fixture-data.ts`, then update `tests/webapp/main.tsx` to route `?fixture=` and `?gitDiffArgs=` URL params to the correct factory.

## Skills Required
- typescript (fixture data factories)
- react-components (main.tsx React app routing)

## Acceptance Criteria
- [ ] `createEmptyPayload(gitDiffArgs?)` returns `{ files: [], source: { type: 'git', gitDiffArgs, repository: '/mock-test-repo' } }`
- [ ] `createMarkdownPayload()` returns 3 DiffFile objects: `docs/new-docs.md` (added), `src/index.ts` (added), `README.md` (modified)
- [ ] The markdown file content has a heading, multi-line paragraph at lines 3-4, list, code block, and mermaid block
- [ ] `main.tsx` reads `?fixture=empty` → `createEmptyPayload(gitDiffArgs)`, `?fixture=markdown` → `createMarkdownPayload()`, default → `createFixturePayload()`
- [ ] `main.tsx` reads `?gitDiffArgs=` and forwards to `createEmptyPayload()`

## Technical Requirements
- Import and use existing `DiffFile`, `DiffHunk`, `DiffLine`, `DiffLoadPayload` types from `src/shared/types.ts`
- The markdown fixture `docs/new-docs.md` must be `changeType: 'added'` with all lines as additions
- `src/index.ts` must be `changeType: 'added'` with TypeScript content
- `README.md` must be `changeType: 'modified'` with simple change (modified .md files do NOT get rendered toggle)
- The multi-line paragraph in the markdown must span lines 3-4 to satisfy the gutter line-range test expecting "3-4"

## Input Dependencies
None — this is a foundational task.

## Output Artifacts
- Updated `tests/webapp/fixture-data.ts` with two new exported functions
- Updated `tests/webapp/main.tsx` with URL param routing

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### fixture-data.ts additions

Add after existing exports:

```typescript
export function createEmptyPayload(gitDiffArgs?: string): DiffLoadPayload {
  return {
    files: [],
    source: { type: 'git', gitDiffArgs, repository: '/mock-test-repo' },
  };
}

export function createMarkdownPayload(): DiffLoadPayload {
  // docs/new-docs.md — added, with heading, paragraph spanning lines 3-4, list, code block, mermaid
  // Design content so rendered paragraph block maps to source lines 3-4:
  // Line 1: # Documentation
  // Line 2: (blank)
  // Line 3: This is a paragraph that spans
  // Line 4: multiple lines for testing.
  // Line 5: (blank)
  // Line 6: ## Features
  // Line 7: (blank)
  // Line 8: - Item one
  // Line 9: - Item two
  // Line 10: - Item three
  // Line 11: (blank)
  // Line 12: ### Code Example
  // Line 13: (blank)
  // Line 14: ```typescript
  // Line 15: const x = 1;
  // Line 16: ```
  // Line 17: (blank)
  // Line 18: ```mermaid
  // Line 19: graph TD
  // Line 20:     A --> B
  // Line 21: ```

  // Build DiffFile with all lines as additions (changeType: 'added')
  // src/index.ts — added, simple TypeScript
  // README.md — modified, simple change
  return { files: [...], source: { type: 'git', repository: '/mock-test-repo' } };
}
```

### main.tsx changes

In the adapter's `loadDiff`, read URL params:

```typescript
const params = new URLSearchParams(window.location.search);
const fixture = params.get('fixture');
const gitDiffArgs = params.get('gitDiffArgs') ?? undefined;

let payload: DiffLoadPayload;
if (fixture === 'empty') {
  payload = createEmptyPayload(gitDiffArgs);
} else if (fixture === 'markdown') {
  payload = createMarkdownPayload();
} else {
  payload = createFixturePayload();
}
```

Import the new functions from fixture-data.ts.

</details>
