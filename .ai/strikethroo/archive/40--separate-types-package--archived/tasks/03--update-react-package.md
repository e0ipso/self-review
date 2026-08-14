---
id: 3
group: types-package
dependencies:
  - 1
status: completed
created: '2026-03-11'
skills:
  - typescript
---
# Update `@self-review/react` to Import from `@self-review/types`

## Objective
In `packages/react/`, replace all `import type { ... } from '@self-review/core'` statements with `import type { ... } from '@self-review/types'`, update `package.json` to move `@self-review/core` to `devDependencies` and add `@self-review/types` to `dependencies`, and update `tsup.config.ts` to treat `@self-review/types` as external.

## Skills Required
TypeScript, npm workspaces.

## Acceptance Criteria
- [ ] All `import type { ... } from '@self-review/core'` in `packages/react/src/` are changed to `import type { ... } from '@self-review/types'`
- [ ] The non-type import `import { isPreviewableImage, isPreviewableSvg } from '@self-review/core'` in `FileSection.tsx` remains unchanged (runtime functions from core, not types)
- [ ] `packages/react/package.json`: `@self-review/core` moved from `dependencies` to `devDependencies`; `@self-review/types: "*"` added to `dependencies`
- [ ] `@self-review/types` added to `external` array in `packages/react/tsup.config.ts`
- [ ] `npm run build` in `packages/react/` exits 0
- [ ] `npx tsc --noEmit` in `packages/react/` reports zero errors

## Technical Requirements
- Files to update (23 import locations across ~14 files):
  - `src/adapter.ts`
  - `src/utils/diff-styles.ts`
  - `src/utils/image-utils.ts`
  - `src/SingleFileReview.tsx`
  - `src/context/ReviewContext.tsx`
  - `src/context/ConfigContext.tsx`
  - `src/ReviewPanel.tsx`
  - `src/components/Comments/SuggestionBlock.tsx`
  - `src/components/Comments/AttachmentThumbnail.tsx`
  - `src/components/Comments/CommentDisplay.tsx`
  - `src/components/Comments/CommentInput.tsx`
  - `src/components/DiffViewer/diff-utils.ts`
  - `src/components/DiffViewer/RenderedSvgView.tsx`
  - `src/components/DiffViewer/RenderedImageView.tsx`
  - `src/components/DiffViewer/SyntaxLine.tsx`
  - `src/components/DiffViewer/UnifiedView.tsx`
  - `src/components/DiffViewer/FileSection.tsx` (type imports only — the `isPreviewableImage`/`isPreviewableSvg` runtime import stays as `@self-review/core`)
  - `src/components/DiffViewer/RenderedMarkdownView.tsx`
  - `src/components/DiffViewer/SplitView.tsx`
  - `src/components/DiffViewer/DiffViewer.test.tsx`
  - `src/index.ts`
  - `src/hooks/useReviewState.ts`

## Input Dependencies
- Task 01: `packages/types/` package must exist

## Output Artifacts
- Modified import statements in all listed files
- Modified `packages/react/package.json`
- Modified `packages/react/tsup.config.ts`

## Implementation Notes

<details>
<summary>Step-by-step implementation</summary>

### 1. Update all type-only imports

For each file listed in Technical Requirements, change:
```ts
import type { Foo, Bar } from '@self-review/core';
```
to:
```ts
import type { Foo, Bar } from '@self-review/types';
```

**IMPORTANT EXCEPTION**: `FileSection.tsx` has TWO imports from `@self-review/core`:
- A `import type { DiffFile, DiffHunk }` — change to `@self-review/types`
- A `import { isPreviewableImage, isPreviewableSvg }` (runtime functions) — keep as `@self-review/core`

### 2. Update `packages/react/package.json`

Move `@self-review/core` from `dependencies` to `devDependencies`:
```json
"dependencies": {
  "@self-review/types": "*",
  // ... all other deps except @self-review/core
},
"devDependencies": {
  "@self-review/core": "*",
  // ... existing devDeps
}
```

### 3. Update `packages/react/tsup.config.ts`

Current `external` array:
```ts
external: [
  'react',
  'react-dom',
  'react/jsx-runtime',
],
```

Add `@self-review/types`:
```ts
external: [
  'react',
  'react-dom',
  'react/jsx-runtime',
  '@self-review/types',
],
```

Note: `@self-review/core` should NOT be in external — its runtime functions (`isPreviewableImage`, `isPreviewableSvg`) need to be bundled into the react dist output.

### 4. Verify

```bash
cd packages/react
npx tsc --noEmit   # zero errors
npm run build      # exits 0
```

</details>
