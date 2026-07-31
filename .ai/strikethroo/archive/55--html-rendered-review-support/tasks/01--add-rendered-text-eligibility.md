---
id: 1
group: "rendered-html-support"
dependencies: []
status: "completed"
created: 2026-05-13
skills:
  - typescript
  - react-components
---
# Add Rendered Text Eligibility for HTML Files

## Objective
Extend the renderer's preview eligibility logic so added `.html` and `.htm` files use the same Raw/Rendered toggle path as added Markdown files, without changing image, SVG, binary, or non-added file behavior.

## Skills Required
This task requires TypeScript and React component skills because it updates file-type predicates and the renderer components that decide preview mode availability and defaults.

## Acceptance Criteria
- [x] Added `.html` and `.htm` files are recognized as rendered-text eligible.
- [x] Added Markdown files remain rendered-text eligible with unchanged behavior.
- [x] Non-added HTML files continue to use the raw diff flow only.
- [x] Image and SVG preview eligibility/default behavior remains unchanged.
- [x] Eligibility checks are expressed through reusable helper functions rather than repeated extension regexes in component code.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Update the React package file-type utilities and renderer eligibility call sites. Focus on the current flow described in the plan: `packages/react/src/components/DiffViewer/FileSection.tsx` computes previewability and `DiffContentArea.tsx` dispatches to the rendered branch. Use existing local naming and import patterns.

## Input Dependencies
None. This is the first implementation task.

## Output Artifacts
- Updated rendered-text file type helper(s) in the React package.
- Updated preview eligibility/default mode wiring in the renderer where Markdown eligibility is currently checked.
- A content-mode value or equivalent signal that later tasks can use to distinguish Markdown from HTML.

## Implementation Notes
<details>
<summary>Detailed implementation guidance</summary>

1. Inspect `packages/react/src/utils/file-type-utils.ts` and the current Markdown/image/SVG helper names before editing. Prefer extending the existing utility module over adding a new one.
2. Add or update helpers along these lines, using the repo's existing style:
   - `isMarkdownFile(filePath: string): boolean` should continue to cover current Markdown extensions.
   - `isHtmlFile(filePath: string): boolean` should return true for `.html` and `.htm`.
   - `getRenderedTextMode(filePath: string): "markdown" | "html" | null` can centralize mode derivation.
   - `isPreviewableRenderedText(filePath: string): boolean` can wrap the mode helper if that matches local style.
3. Update `FileSection.tsx` so the Raw/Rendered toggle is available only when `file.changeType === "added"` and the file is rendered-text eligible, or when it already qualifies for image/SVG preview through existing branches.
4. Preserve current default-mode behavior:
   - Markdown should keep its existing default.
   - Raster image behavior should remain Rendered by default.
   - SVG behavior should remain Raw by default.
   - HTML should participate in the rendered-text toggle; choose the default that best matches the existing Markdown path unless existing code makes another choice obvious.
5. Update `DiffContentArea.tsx` only as needed to pass the rendered-text mode to the rendered component path. Do not introduce a separate HTML preview branch.
6. Keep this task focused on eligibility and dispatch data. The actual HTML rendering behavior belongs in Task 2.
7. Do not change core package duplicated utilities unless the React renderer imports or tests require it for this feature. If you do change duplicated file-type utilities, keep names and behavior synchronized intentionally.
</details>
