---
id: 5
group: "preview-parity"
dependencies: [2, 4]
status: "pending"
created: "2026-03-11"
skills:
  - "react-components"
  - "typescript"
---
# FileSection Image/SVG Preview Parity in packages/react

## Objective
Move image and SVG rendered preview support into the package-side `FileSection` component via adapter contracts, so the package component matches current Electron UX for supported files and error states. This eliminates the last substantive behavioral divergence between renderer and package `FileSection`.

## Skills Required
- react-components (React component extension)
- TypeScript (adapter interface design)

## Acceptance Criteria
- [ ] `packages/react/src/components/DiffViewer/FileSection.tsx` supports Raw/Rendered toggle for newly-added image files (JPG, PNG, GIF, WebP, ICO, BMP) and SVG files
- [ ] Image loading is performed via an `onLoadImage` adapter prop (async callback returning base64 data URI or error); package component does not call `window.electronAPI` directly
- [ ] SVG content is extracted from addition lines and rendered via data-URI `<img>` (same as current renderer behavior)
- [ ] Error states are handled: oversized images (>10 MB) display error message; load failures display error message
- [ ] `rg "window\\.electronAPI" packages/react/src` returns no matches (no direct IPC in package)
- [ ] Renderer shell wires `onLoadImage` to `window.electronAPI.loadImage`
- [ ] `npm run --workspace @self-review/react test:unit` passes

## Technical Requirements
- Use `isPreviewableImage` and `isPreviewableSvg` from `@self-review/core` (`packages/core/src/file-type-utils.ts`)
- `onLoadImage` adapter signature: `(filePath: string) => Promise<ImageLoadResult>` where `ImageLoadResult` is the existing type from `src/shared/types.ts`
- SVG extraction: pull SVG content from `DiffLine` additions (same logic as current `RenderedSvgView.tsx`)
- Rendered view for images defaults to rendered; SVG defaults to raw (match current renderer behavior)
- Image size limit: 10 MB (same as current renderer)

## Input Dependencies
- Task 02: resolver alignment (so `@self-review/core` imports work in package)
- Task 04: config injection pattern established (for consistency in adapter prop patterns)

## Output Artifacts
- Updated `packages/react/src/components/DiffViewer/FileSection.tsx` with preview support
- New or updated adapter prop interface (`ImageAdapter` or inline props)
- Updated renderer shell to pass `onLoadImage` adapter to package `FileSection` (or to the provider)
- `RenderedImageView` and `RenderedSvgView` components moved to or mirrored in `packages/react/src/`

## Implementation Notes

<details>
<summary>Adapter contract and implementation approach</summary>

**Adapter props to add to FileSection:**
```tsx
interface FileSectionProps {
  // ... existing props ...
  onLoadImage?: (filePath: string) => Promise<ImageLoadResult>;
}
```

**Implementation steps:**
1. Check `src/renderer/components/DiffViewer/FileSection.tsx` for existing image/SVG toggle logic
2. Identify `RenderedImageView.tsx` and `RenderedSvgView.tsx` — move or copy to `packages/react/src/components/DiffViewer/`
3. In package `FileSection`, add image/SVG detection using `isPreviewableImage`/`isPreviewableSvg`
4. Add Raw/Rendered toggle (same UI pattern as Markdown toggle)
5. For image: call `onLoadImage` prop, handle loading/error states, render base64 data-URI in `<img>`
6. For SVG: extract SVG text from addition lines, render as data-URI `<img>` (no adapter needed since content is already in diff lines)
7. Wire in renderer shell: pass `onLoadImage={(filePath) => window.electronAPI.loadImage({ filePath })}` to the component tree
8. Error cases: files >10 MB should return an error result from `onLoadImage`; package component displays error message
9. Run `rg "window\\.electronAPI" packages/react/src` to confirm no direct IPC calls remain

**SVG extraction note:** SVG content comes from the `+` lines in the diff (the new file content). Extract by joining addition lines and wrapping as a data-URI. This is already done in `RenderedSvgView.tsx` — replicate that logic in the package component.
</details>
