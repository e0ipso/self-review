---
id: 5
group: renderer
dependencies:
  - 2
  - 3
  - 4
status: completed
created: '2026-03-09'
skills:
  - react-components
  - typescript
---
# Integrate Rendered Preview Views into FileSection

## Objective
Wire `RenderedImageView` and `RenderedSvgView` into `FileSection.tsx`. Generalise the existing `markdownViewMode` state to `renderViewMode` covering all three previewable types (Markdown, raster images, SVGs), and show the Raw/Rendered toggle for eligible new files.

## Skills Required
- React components — state management, conditional rendering, toggle UI
- TypeScript — type guards, props

## Acceptance Criteria
- [ ] Raster image files (`isBinary === true` and `isPreviewableImage(file.newPath)`) with `changeType === 'added'` display `RenderedImageView` as their default view (toggle defaults to "Rendered")
- [ ] Raster image Raw view shows the existing "Binary file — no diff available" placeholder
- [ ] SVG files (`isPreviewableSvg(file.newPath)`) with `changeType === 'added'` show a Raw/Rendered toggle defaulting to "Raw" (consistent with Markdown)
- [ ] SVG Rendered view shows `RenderedSvgView`; Raw view shows the existing unified/split diff
- [ ] Markdown behaviour is unchanged
- [ ] Non-added files, non-previewable files, and binary non-image files are unaffected
- [ ] `markdownViewMode` state is renamed/generalised to `renderViewMode` (one state variable covers all three types)
- [ ] The Raw/Rendered `ToggleGroup` in the file header renders only for eligible files

## Technical Requirements
- Import `isPreviewableImage` and `isPreviewableSvg` from `@self-review/core` (or from `packages/core/src/file-type-utils` via relative import — follow the existing import pattern used elsewhere in the codebase)
- Import `RenderedImageView` and `RenderedSvgView` from `./RenderedImageView` and `./RenderedSvgView`
- Rename existing `markdownViewMode` state to `renderViewMode` (or use a generalised name); initial value:
  - `'rendered'` for raster images (default to rendered view)
  - `'raw'` for SVG and Markdown (default to raw view, matching current Markdown behaviour)
- Eligibility check helper inside the component (or extracted):
  ```ts
  const isAddedFile = file.changeType === 'added';
  const showImagePreview = isAddedFile && file.isBinary && isPreviewableImage(file.newPath ?? '');
  const showSvgPreview = isAddedFile && isPreviewableSvg(file.newPath ?? '');
  const showMarkdownPreview = isAddedFile && isMarkdownFile(file.newPath ?? ''); // existing logic
  const isPreviewable = showImagePreview || showSvgPreview || showMarkdownPreview;
  ```
- Existing toggle `ToggleGroup` visibility condition: replace Markdown-only check with `isPreviewable`
- Rendering logic in the content area (where diff/binary message currently renders):
  - If `showImagePreview && renderViewMode === 'rendered'` → `<RenderedImageView filePath={file.newPath} />`
  - If `showImagePreview && renderViewMode === 'raw'` → existing binary placeholder
  - If `showSvgPreview && renderViewMode === 'rendered'` → `<RenderedSvgView file={file} />`
  - Otherwise → existing unified/split diff rendering (unchanged)

## Input Dependencies
- Task 01: `isPreviewableImage`, `isPreviewableSvg`
- Task 02: IPC channel wired (needed for `RenderedImageView` to work at runtime)
- Task 03: `RenderedImageView` component
- Task 04: `RenderedSvgView` component

## Output Artifacts
- Updated `src/renderer/components/DiffViewer/FileSection.tsx`

## Implementation Notes

<details>
<summary>Implementation details</summary>

### Locate existing markdownViewMode
Search `FileSection.tsx` for `markdownViewMode` (or whatever the current state variable is named for the Markdown Raw/Rendered toggle). Rename it to `renderViewMode` across the component.

### Import additions at the top of FileSection.tsx
```ts
import { isPreviewableImage, isPreviewableSvg } from '../../../../packages/core/src/file-type-utils';
import RenderedImageView from './RenderedImageView';
import RenderedSvgView from './RenderedSvgView';
```
Check how `RenderedMarkdownView` is currently imported to confirm the relative path convention. Follow the same pattern used for other packages (the project imports from relative paths to `packages/core/src/` directly).

### Initial renderViewMode value
```ts
const initialViewMode = (isAddedFile && file.isBinary && isPreviewableImage(file.newPath ?? ''))
  ? 'rendered'
  : 'raw';
const [renderViewMode, setRenderViewMode] = useState<'raw' | 'rendered'>(initialViewMode);
```

### Toggle rendering condition
The Raw/Rendered `ToggleGroup` should render when `isPreviewable` is true. The toggle item labels stay "Raw" and "Rendered".

### Content area rendering
Find where `RenderedMarkdownView` is currently conditionally rendered and the binary-file placeholder is shown. Extend that conditional block to handle images and SVGs:
```tsx
{showImagePreview && renderViewMode === 'rendered' ? (
  <RenderedImageView filePath={file.newPath ?? ''} />
) : showSvgPreview && renderViewMode === 'rendered' ? (
  <RenderedSvgView file={file} />
) : file.isBinary ? (
  // existing binary placeholder
) : showMarkdownPreview && renderViewMode === 'rendered' ? (
  <RenderedMarkdownView ... />
) : (
  // existing SplitView / UnifiedView
)}
```

The exact structure will depend on the current FileSection code — adapt to fit the existing conditional flow rather than replacing it wholesale.
</details>
