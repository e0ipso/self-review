---
id: 2
group: 'testing'
dependencies: [1]
status: 'completed'
created: 2026-02-24
skills:
  - vitest
  - react-testing
---

# Add Unit Test Verifying Viewed State Preservation

## Objective

Add a unit test that verifies expanding context (updating `allDiffFiles`) does not reset `viewed` flags or lose comments on files that already have review state.

## Skills Required

- Vitest testing framework
- React testing (hooks or component testing)

## Acceptance Criteria

- [ ] Test verifies that after initial load, marking files as viewed, and then updating hunks for one file, the viewed flags and comments on other files are preserved
- [ ] Test passes with the fix in place
- [ ] Test is colocated with the source (in `src/renderer/context/` or `src/renderer/hooks/`)

## Technical Requirements

- Use Vitest with jsdom environment (renderer test config)
- Test the `useReviewState` hook or the `ReviewContext` behavior
- Mock `window.electronAPI` as needed

## Input Dependencies

- Task 001 must be completed (the fix must be in place)

## Output Artifacts

- New test file verifying the fix
