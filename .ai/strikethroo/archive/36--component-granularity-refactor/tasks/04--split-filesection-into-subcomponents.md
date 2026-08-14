---
id: 4
group: "filesection-refactor"
dependencies: [2, 3]
status: "completed"
created: "2026-03-11"
skills: ["react-components", "typescript"]
---
# Split `FileSection` into `FileSectionHeader`, `FileSectionBody`, and `DiffContentArea`

## Objective
After the two hook extractions (Tasks 2 and 3), decompose the remaining JSX of `FileSection.tsx` into three focused presentational components: `FileSectionHeader`, `FileSectionBody`, and `DiffContentArea`. `FileSection.tsx` becomes a slim orchestration-only component.

## Skills Required
- react-components
- typescript

## Acceptance Criteria
- [ ] `FileSectionHeader.tsx` exists in `packages/react/src/components/DiffViewer/` and renders only the sticky header bar (path, badges, stats, view-mode toggle, viewed toggle, add-comment button)
- [ ] `FileSectionBody.tsx` exists and renders file-level comments list + `DiffContentArea`
- [ ] `DiffContentArea.tsx` exists and renders the loading spinner, error retry, binary-file notice, no-changes notice, and dispatches to `SplitView` / `UnifiedView` / `RenderedMarkdownView`
- [ ] `FileSection.tsx` is reduced to ~120 lines or fewer: calls both hooks, assembles props, composes the three layout components
- [ ] Context hooks (`useReview`, `useConfig`) are called directly in sub-components where needed rather than prop-drilling all values
- [ ] `npm run test:unit` passes
- [ ] `npm run test:e2e` passes

## Technical Requirements
- Source file: `packages/react/src/components/DiffViewer/FileSection.tsx` (already reduced by Tasks 2 and 3)
- New files (all in `packages/react/src/components/DiffViewer/`):
  - `FileSectionHeader.tsx`
  - `FileSectionBody.tsx`
  - `DiffContentArea.tsx`
- Only genuinely local state (e.g., `commentRange`, `dragState`) is threaded as props; context-derived values are obtained via hooks in the sub-component
- `sectionRef` (returned by `useExpandContext`) is attached to the outermost element in `FileSection.tsx` and passed down only if needed for anchoring

## Input Dependencies
- Task 2 output: `useDragSelection` hook integrated into `FileSection.tsx`
- Task 3 output: `useExpandContext` hook integrated into `FileSection.tsx`

## Output Artifacts
- `packages/react/src/components/DiffViewer/FileSectionHeader.tsx`
- `packages/react/src/components/DiffViewer/FileSectionBody.tsx`
- `packages/react/src/components/DiffViewer/DiffContentArea.tsx`
- Updated `packages/react/src/components/DiffViewer/FileSection.tsx` (orchestrator only)

## Implementation Notes

<details>
<summary>Step-by-step implementation</summary>

1. **Read the post-hook `FileSection.tsx`** (after Tasks 2 and 3 are applied) and identify three distinct JSX regions:
   - The sticky header bar section → `FileSectionHeader`
   - The file-level comments area → part of `FileSectionBody`
   - The content loading/dispatch area → `DiffContentArea`

2. **Create `FileSectionHeader.tsx`**:
   - Props: file metadata, badge/stats, viewed state, rendered-view toggle state, callbacks for viewed-toggle and add-comment
   - Can call `useConfig` directly if needed for theme/display config
   - Produces the sticky `<div>` header with file path, change badges, expand/collapse control, view-mode toggle, viewed checkbox, and add-comment button

3. **Create `DiffContentArea.tsx`**:
   - Props: loading state, error state, file metadata, rendered view mode, hunk data, expandLoading, handleExpandContext, dragState, handleDragStart, etc.
   - Renders exclusively: loading spinner OR error message with retry OR binary-file notice OR no-changes notice OR the appropriate view (`SplitView` / `UnifiedView` / `RenderedMarkdownView`)
   - This is a pure dispatcher — no state of its own

4. **Create `FileSectionBody.tsx`**:
   - Props: file comments list, file-comment input visibility flag, filePath, and the props to pass through to `DiffContentArea`
   - Renders file-level `CommentDisplay` items, the file-level `CommentInput`, and then `<DiffContentArea />`

5. **Update `FileSection.tsx`**:
   - Call `useDragSelection(...)` and `useExpandContext(...)`
   - Assemble props for each of the three layout components
   - Return: `<section ref={sectionRef}><FileSectionHeader .../><FileSectionBody .../></section>`

6. **Run `npm run test:unit && npm run test:e2e`** and confirm no failures.

7. **Size check**: `FileSection.tsx` should be ~120 lines or fewer.

</details>
