---
id: 1
group: infrastructure
dependencies: []
status: completed
created: '2026-03-09'
skills:
  - typescript
---
# Add File-Type Detection Utilities to @self-review/core

## Objective
Add `isPreviewableImage()` and `isPreviewableSvg()` pure utility functions to the `@self-review/core` package so that file-type classification logic is centralised and reused across the Electron app and the React package.

## Skills Required
TypeScript — pure utility functions with extension mapping.

## Acceptance Criteria
- [ ] `isPreviewableImage(filePath: string): boolean` returns `true` for `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.ico`, `.bmp` (case-insensitive), `false` otherwise
- [ ] `isPreviewableSvg(filePath: string): boolean` returns `true` for `.svg` (case-insensitive), `false` otherwise
- [ ] Both functions are exported from `packages/core/src/index.ts` (or an appropriate barrel)
- [ ] Unit tests cover each supported extension and a negative case

## Technical Requirements
- Location: `packages/core/src/` — create a new file `file-type-utils.ts`
- Extension comparison must be case-insensitive (e.g. `.JPG` should match)
- Use `path.extname()` or simple string manipulation — no external dependencies
- Export from the package's existing index/barrel export

## Input Dependencies
None — this is a foundational utility task.

## Output Artifacts
- `packages/core/src/file-type-utils.ts` — two exported functions
- `packages/core/src/file-type-utils.test.ts` — unit tests
- Updated `packages/core/src/index.ts` barrel export

## Implementation Notes

<details>
<summary>Implementation details</summary>

### File: `packages/core/src/file-type-utils.ts`

```ts
import path from 'path';

const RASTER_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico', '.bmp']);

export function isPreviewableImage(filePath: string): boolean {
  return RASTER_IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function isPreviewableSvg(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.svg';
}
```

### Export from barrel
Add to `packages/core/src/index.ts`:
```ts
export { isPreviewableImage, isPreviewableSvg } from './file-type-utils';
```

### Unit tests
Create `packages/core/src/file-type-utils.test.ts` using Vitest. Cover:
- Each raster extension (positive) — `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.ico`, `.bmp`
- Case-insensitive: `.PNG`, `.JPG`
- Negative: `.svg` returns false for `isPreviewableImage`, `.ts` returns false for both
- `.svg` returns true for `isPreviewableSvg`, `.png` returns false for `isPreviewableSvg`

Run with: `npm run test:unit:main` (the core package tests run in Node environment)
</details>
