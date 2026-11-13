---
id: 2
group: "language-mapping"
dependencies: []
status: "completed"
created: 2026-11-13
skills:
  - typescript
  - vitest
complexity_score: 2
---
# Map the .svelte extension in both getLanguageFromPath copies

## Objective
Make `getLanguageFromPath('…/X.svelte')` return `'svelte'` in both `packages/react/src/utils/file-type-utils.ts` and its documented duplicate `packages/core/src/file-type-utils.ts`, and add a small colocated test for each copy.

## Skills Required
TypeScript and Vitest.

## Acceptance Criteria
- [ ] Both `langMap` objects contain `svelte: 'svelte'`.
- [ ] New `packages/react/src/utils/file-type-utils.test.ts` asserts `getLanguageFromPath('src/App.svelte') === 'svelte'`, `'src/a.ts' → 'typescript'`, `'docs/page.html' → 'markup'`, `'notes.unknownext' → 'plaintext'`.
- [ ] New `packages/core/src/file-type-utils.test.ts` asserts the same four cases against the core copy.
- [ ] Verification: `npx vitest run --config vitest.config.renderer.ts packages/react/src/utils/file-type-utils.test.ts` exits 0, and `npx vitest run --config packages/core/vitest.config.ts --root packages/core src/file-type-utils.test.ts` (or `npm test --workspace @self-review/core -- src/file-type-utils.test.ts`, whichever the package supports) exits 0.
- [ ] `npx eslint` and `npx prettier --check` on the four touched files exit 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- No other mapping changes. Keep the entry alongside the web languages (`html`, `htm`, `xml`) in each map.
- The two copies must stay identical in logic (AGENTS.md: "If you change the logic here, update the copy in packages/core/src/file-type-utils.ts too").

## Input Dependencies
None.

## Output Artifacts
- Edited `packages/react/src/utils/file-type-utils.ts` and `packages/core/src/file-type-utils.ts`.
- New `packages/react/src/utils/file-type-utils.test.ts` and `packages/core/src/file-type-utils.test.ts`.

## Implementation Notes
<details>
<summary>Step-by-step guidance</summary>

1. In each `file-type-utils.ts`, add `svelte: 'svelte',` right after `xml: 'markup',` in `langMap`.
2. Create the two test files with `import { describe, it, expect } from 'vitest';` (explicit import works whether or not globals are enabled) and `import { getLanguageFromPath } from './file-type-utils';`. One `describe('getLanguageFromPath')` with one `it` asserting the four cases is enough.
3. Check how core runs tests: read `packages/core/package.json` `scripts.test` and `packages/core/vitest.config.ts` (it includes `src/**/*.test.ts`). Run the single test file accordingly.
4. Run eslint and prettier on the touched files.

Test philosophy (copied from task generation rules): write a few tests, mostly integration. Do not write tests for trivial static configuration beyond what the plan requires; the plan explicitly requires these mapping tests (clarification 9), so keep each to a single compact `it`.
</details>
