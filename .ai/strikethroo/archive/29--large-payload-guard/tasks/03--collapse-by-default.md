---
id: 3
group: "large-payload-guard"
dependencies: [1]
status: "completed"
created: "2026-03-04"
skills:
  - react
---
# Collapse-by-Default for Large File Sets

## Objective
Modify `DiffViewer.tsx` to initialize all file sections as collapsed when the file count exceeds
an internal threshold of 50 files. This reduces initial DOM pressure and visual overload for
medium-to-large reviews.

## Skills Required
- react: State initialization logic, effect dependencies, component rendering

## Acceptance Criteria
- [ ] When `diffFiles.length <= 50`, files initialize as expanded (preserving current behavior)
- [ ] When `diffFiles.length > 50`, files initialize as collapsed
- [ ] The threshold (`50`) is defined as a named constant (e.g., `COLLAPSE_THRESHOLD`)
- [ ] When new files are loaded/replaced (e.g., welcome-screen directory start), the same threshold logic applies
- [ ] "Expand All" / "Collapse All" toolbar actions still work correctly
- [ ] Unit test verifies collapsed initialization when file count > 50
- [ ] Unit test verifies expanded initialization when file count <= 50

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Modify the `expandedState` initialization in `DiffViewer.tsx` (around lines 12-19)
- Modify the `useEffect` that handles `diffFiles` changes (around lines 23-34)
- Keep the threshold as an internal constant, NOT a user-configurable value
- Do not change the expand/collapse toggle behavior — only the initial default

## Input Dependencies
- Task 01: No type changes needed for this task, but it runs after Task 01 to avoid merge conflicts on shared files

## Output Artifacts
- Updated `src/renderer/components/DiffViewer/DiffViewer.tsx`
- Unit tests for collapse-by-default behavior
