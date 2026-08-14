---
id: 4
group: types-package
dependencies:
  - 1
status: completed
created: '2026-03-11'
skills:
  - typescript
---
# Update Electron App `src/shared/types.ts` to Point at `@self-review/types`

## Objective
Update `src/shared/types.ts` to re-export from `../../packages/types/src/index` instead of `../../packages/core/src/types`, and remove the duplicate `ImageLoadResult` definition (now canonically defined in `@self-review/types`).

## Skills Required
TypeScript, Electron main/renderer architecture.

## Acceptance Criteria
- [ ] `src/shared/types.ts` re-exports from `../../packages/types/src/index` (not from `../../packages/core/src/types`)
- [ ] The duplicate `export type ImageLoadResult = ...` definition is removed from `src/shared/types.ts`
- [ ] `ImageLoadResult` is instead imported from `../../packages/types/src/index` via the re-export
- [ ] The second `import type { ... } from '../../packages/core/src/types'` block inside `src/shared/types.ts` (used for the `ElectronAPI` interface) is also updated to point at `../../packages/types/src/index`
- [ ] `npx tsc --noEmit` from the workspace root (or in `src/`) exits 0

## Technical Requirements
- The Electron app uses direct relative path imports to package source files (not workspace symlinks), so the path must be `../../packages/types/src/index`
- After the change, `ImageLoadResult` must still be available as a named export from `src/shared/types.ts` (it's used in `ElectronAPI.loadImage`)
- All other re-exported types must remain available

## Input Dependencies
- Task 01: `packages/types/src/index.ts` must exist and export all types including `ImageLoadResult`

## Output Artifacts
- Modified `src/shared/types.ts`

## Implementation Notes

<details>
<summary>Step-by-step implementation</summary>

### Current state of `src/shared/types.ts`

The file has two sections:
1. A named re-export block from `../../packages/core/src/types` (lines 3–27)
2. A local `ImageLoadResult` type definition (line 32)
3. A second `import type { ... }` block from `../../packages/core/src/types` used in the `ElectronAPI` interface (lines 37–49)

### Target state

Replace both import paths (`../../packages/core/src/types`) with `../../packages/types/src/index`.

Remove the duplicate `ImageLoadResult` definition — it is now exported from `@self-review/types` and will be included automatically via the re-export barrel.

The new file should look like this:

```ts
// Re-export all types from the canonical source in @self-review/types.
// This file exists for backward compatibility — all src/ code imports from here.
export type {
  ChangeType,
  DiffLineType,
  DiffLine,
  DiffHunk,
  DiffFile,
  DiffSource,
  Suggestion,
  Attachment,
  LineRange,
  ReviewComment,
  FileReviewState,
  ReviewState,
  CategoryDef,
  AppConfig,
  DiffLoadPayload,
  ResumeLoadPayload,
  OutputPathInfo,
  ExpandContextRequest,
  ExpandContextResponse,
  FindInPageRequest,
  FindInPageResult,
  VersionUpdateInfo,
  PayloadStats,
  ImageLoadResult,
} from '../../packages/types/src/index';

// ===== Electron API (preload bridge) =====
// Electron-specific — not part of @self-review/types.

import type {
  DiffLoadPayload,
  AppConfig,
  OutputPathInfo,
  ResumeLoadPayload,
  ReviewState,
  ExpandContextRequest,
  ExpandContextResponse,
  FindInPageRequest,
  FindInPageResult,
  VersionUpdateInfo,
  DiffHunk,
  ImageLoadResult,
} from '../../packages/types/src/index';

export interface ElectronAPI {
  // ... (keep unchanged)
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

Key changes:
- Both import paths changed from `../../packages/core/src/types` → `../../packages/types/src/index`
- `ImageLoadResult` added to the named re-export block (was previously a local definition)
- The standalone `export type ImageLoadResult = ...` line is removed
- The comment `// ===== Image Loading =====` section is removed

</details>
