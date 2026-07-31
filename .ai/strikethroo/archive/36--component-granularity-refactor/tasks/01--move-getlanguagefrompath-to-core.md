---
id: 1
group: "core-utilities"
dependencies: []
status: "completed"
created: "2026-03-11"
skills: ["typescript"]
---
# Move `getLanguageFromPath` to `@self-review/core`

## Objective
Move the `getLanguageFromPath` function from `SyntaxLine.tsx` into `packages/core/src/file-type-utils.ts`, export it from the core package index, and update all callers to import from `@self-review/core`.

## Skills Required
- typescript

## Acceptance Criteria
- [ ] `getLanguageFromPath` is defined exactly once, in `packages/core/src/file-type-utils.ts`
- [ ] The function is exported from `packages/core/src/index.ts`
- [ ] `SyntaxLine.tsx` imports `getLanguageFromPath` from the core package (via relative path to source)
- [ ] Any other files that imported `getLanguageFromPath` from `SyntaxLine.tsx` are updated to import from the core package source
- [ ] `npm run test:unit` passes

## Technical Requirements
- Target source: `packages/react/src/components/DiffViewer/SyntaxLine.tsx`
- Destination: `packages/core/src/file-type-utils.ts` alongside `isPreviewableImage` and `isPreviewableSvg`
- Core index: `packages/core/src/index.ts`
- The renderer imports packages via relative path (e.g., `../../packages/react/src/...`), so core package imports in react components use the relative path to the core source

## Input Dependencies
None

## Output Artifacts
- `packages/core/src/file-type-utils.ts` — contains `getLanguageFromPath` (moved from SyntaxLine)
- `packages/core/src/index.ts` — exports `getLanguageFromPath`
- Updated `SyntaxLine.tsx` — imports `getLanguageFromPath` from core source
- Updated any other files that re-exported or imported `getLanguageFromPath` from `SyntaxLine.tsx`

## Implementation Notes

<details>
<summary>Step-by-step implementation</summary>

1. **Read the current `getLanguageFromPath` implementation** in `packages/react/src/components/DiffViewer/SyntaxLine.tsx`. It maps file extensions to Prism.js language strings.

2. **Open `packages/core/src/file-type-utils.ts`** and append the `getLanguageFromPath` function at the end of the file, alongside the existing `isPreviewableImage` and `isPreviewableSvg` functions. Keep the same function signature and body.

3. **Export `getLanguageFromPath`** from `packages/core/src/index.ts` alongside the other file-type utilities.

4. **Remove the `getLanguageFromPath` definition** from `SyntaxLine.tsx` and replace it with an import from the core source. The import path from a file in `packages/react/src/components/DiffViewer/` to core source is `../../../../core/src/file-type-utils` (or via the barrel `../../../../core/src/index`).

5. **Search the codebase** for any file that imports `getLanguageFromPath` from `SyntaxLine` (e.g., `SplitView.tsx`, `UnifiedView.tsx`) and update those imports to point directly to the core source as well.

6. **Run `npm run test:unit`** from the workspace root to confirm no breakage.

7. **Verify**: `grep -r "getLanguageFromPath" packages/react/src` should show only import statements, no definitions. `grep -r "getLanguageFromPath" packages/core/src` should show exactly one definition.

</details>
