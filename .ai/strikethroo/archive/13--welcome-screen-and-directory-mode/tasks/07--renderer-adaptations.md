---
id: 7
group: "renderer"
dependencies: [1, 5]
status: "completed"
created: "2026-02-16"
skills:
  - react-components
---

# Adapt Renderer Components for Multi-Mode Support

## Objective

Update `Toolbar.tsx`, `DiffViewer.tsx` (empty state), and `ReviewContext.tsx` to use the `DiffSource` type and display mode-appropriate content.

## Skills Required

- React component development

## Acceptance Criteria

- [ ] `ReviewContext.tsx` stores `source: DiffSource` instead of separate `gitDiffArgs` + `repository` fields
- [ ] `Toolbar.tsx` shows `git diff {args}` for git mode and the directory path for directory mode
- [ ] `DiffViewer.tsx` empty state shows git-specific help for git mode and directory-specific guidance for directory mode
- [ ] No visual changes in git mode (existing behavior preserved)
- [ ] TypeScript compiles with zero errors
- [ ] Existing renderer unit tests pass

## Technical Requirements

- Use `source.type` discriminant for conditional rendering
- Toolbar should use a switch or conditional to display the appropriate context string
- Empty state help text must be mode-aware

## Input Dependencies

- Task 1: `DiffSource` type definition
- Task 5: Startup flow sends `source` via `diff:load` payload

## Output Artifacts

- Updated `src/renderer/context/ReviewContext.tsx`
- Updated `src/renderer/components/Toolbar.tsx`
- Updated `src/renderer/components/DiffViewer/DiffViewer.tsx` (or wherever empty state is rendered)

## Implementation Notes

<details>

1. **Update `ReviewContext.tsx`**:
   - Find where `gitDiffArgs` and `repository` are stored in state
   - Replace with a single `source: DiffSource` state field
   - Update the context value and any setter functions
   - Update the `diff:load` listener to extract `source` from the payload
   - Update the `review:submit` handler to include `source` in the submitted state

2. **Update `Toolbar.tsx`**:
   - Read `source` from context instead of `gitDiffArgs`
   - Render based on `source.type`:
     ```tsx
     {source.type === 'git' && <span>git diff {source.gitDiffArgs}</span>}
     {source.type === 'directory' && <span>Directory: {source.sourcePath}</span>}
     ```
   - For `'welcome'` type, the toolbar may not be visible (welcome screen is shown instead)

3. **Update `DiffViewer.tsx` empty state**:
   - Find the "no files" or "empty diff" help text
   - Make it mode-aware:
     - Git mode: existing help text about git diff options
     - Directory mode: "No files found in the selected directory" or similar
   - Read `source` from context to determine which text to show

4. **Run renderer tests**: `npm run test:unit:renderer` to verify nothing breaks.

</details>
