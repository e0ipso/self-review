---
id: 1
group: 'bug-fix'
dependencies: []
status: 'completed'
created: 2026-02-24
skills:
  - react-state-management
  - typescript
---

# Fix useEffect to Preserve Existing Review State on Context Expansion

## Objective

Modify the `useEffect` in `src/renderer/context/ReviewContext.tsx` (lines 92–103) that initializes `FileReviewState` from `allDiffFiles` so that it preserves existing `viewed` and `comments` values for files that already have state entries, instead of unconditionally resetting them.

## Skills Required

- React state management (useState callback pattern)
- TypeScript

## Acceptance Criteria

- [ ] Expanding context in any file does NOT reset `viewed` flags on other files
- [ ] Expanding context does NOT lose comments on any file
- [ ] Initial diff load still correctly initializes all files with `viewed: false`
- [ ] `--resume-from` still correctly restores prior comments and viewed state
- [ ] No other files are modified besides `ReviewContext.tsx`

## Technical Requirements

Use the callback form of `reviewState.setFiles` to access previous state and merge:

- For files that already exist in the previous state: keep their `viewed` and `comments` values
- For genuinely new files (initial load): initialize with `viewed: false` and empty `comments`
- Build a lookup map from previous state for O(1) access

The change is confined to lines 92–103 of `ReviewContext.tsx`.

## Input Dependencies

None — this is a standalone bug fix.

## Output Artifacts

- Modified `src/renderer/context/ReviewContext.tsx` with the fixed `useEffect`
