---
id: 11
group: "documentation"
dependencies: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
status: "completed"
created: "2026-03-11"
skills: ["typescript"]
---
# Update `AGENTS.md` Documentation

## Objective
Update `AGENTS.md` to reflect the new component structure after the refactor: add the new component and hook names to the Project Structure section, and note that `getLanguageFromPath` is now exported from `@self-review/core`.

## Skills Required
- typescript

## Acceptance Criteria
- [ ] `AGENTS.md` Project Structure section lists all new files: `FileSectionHeader`, `FileSectionBody`, `DiffContentArea`, `InlineCommentSlot`, `AttachmentDropZone`, `SuggestionPanel`, `AttachmentImage`, `EmptyDiffMessage`, `FileTreeEntry`
- [ ] `AGENTS.md` hooks section (or appropriate location) lists `useDragSelection` and `useExpandContext`
- [ ] `AGENTS.md` notes that `getLanguageFromPath` is exported from `@self-review/core`
- [ ] No other documentation files are modified (PRD.md and Cucumber feature files are unchanged)

## Technical Requirements
- File: `/workspace/AGENTS.md`
- Do not modify `docs/PRD.md` — this is a code quality refactor with no user-visible feature changes
- Do not modify any Cucumber feature files under `test/features/`

## Input Dependencies
- All prior tasks completed (new files exist and are verified working)

## Output Artifacts
- Updated `/workspace/AGENTS.md`

## Implementation Notes

<details>
<summary>Step-by-step implementation</summary>

1. **Read `AGENTS.md`** and locate:
   - The Project Structure section with the `DiffViewer/` and `Comments/` tree
   - Any mention of `@self-review/core` exports
   - The hooks listing (if any)

2. **Update the DiffViewer component tree** to add:
   - `FileSectionHeader.tsx`
   - `FileSectionBody.tsx`
   - `DiffContentArea.tsx`
   - `InlineCommentSlot.tsx`
   - `EmptyDiffMessage.tsx`

3. **Update the hooks section** (under `src/renderer/hooks/` or wherever hooks are documented) to add:
   - `useDragSelection.ts`
   - `useExpandContext.ts`
   (These live in `packages/react/src/components/DiffViewer/` — note the correct location)

4. **Update the Comments component tree** to add:
   - `AttachmentDropZone.tsx`
   - `SuggestionPanel.tsx`
   - `AttachmentImage.tsx`

5. **Update the FileTree area** to note `FileTreeEntry.tsx`.

6. **Add a note** near the `@self-review/core` section that `getLanguageFromPath` is exported from the core package alongside `isPreviewableImage` and `isPreviewableSvg`.

7. **Do not change** any functional descriptions, architecture sections, or IPC channel table — only the structural component listings need updating.

</details>
