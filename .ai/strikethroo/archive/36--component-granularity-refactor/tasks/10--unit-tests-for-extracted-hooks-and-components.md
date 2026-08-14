---
id: 10
group: "testing"
dependencies: [2, 3, 4, 5]
status: "completed"
created: "2026-03-11"
skills: ["jest"]
---
# Unit Tests for Extracted Hooks and `InlineCommentSlot`

## Objective
Write focused unit tests for the three highest-complexity extracted units: `useDragSelection`, `useExpandContext`, and `InlineCommentSlot`. These cover custom business logic and state transitions not exercised by the existing e2e suite.

## Skills Required
- jest

## Acceptance Criteria
- [ ] `useDragSelection.test.ts` tests: initial state, drag start sets state, drag end commits range, mouseup without drag is no-op, `trigger-line-comment` custom event starts a range
- [ ] `useExpandContext.test.ts` tests: `handleExpandContext` calls IPC with correct args, `expandLoading` is true during fetch and false after, hunk trimming logic for budget tracking
- [ ] `InlineCommentSlot.test.tsx` tests: renders existing comments, renders `CommentInput` when `showCommentInput` is true, applies `indentClass` correctly
- [ ] All new tests pass with `npm run test:unit`
- [ ] No test-specific workarounds introduced in production source files

## Technical Requirements
- Test framework: Vitest (existing project setup)
- Test files colocated with source:
  - `packages/react/src/components/DiffViewer/useDragSelection.test.ts`
  - `packages/react/src/components/DiffViewer/useExpandContext.test.ts`
  - `packages/react/src/components/DiffViewer/InlineCommentSlot.test.tsx`
- Use `renderHook` from `@testing-library/react` for hook tests
- Mock IPC calls (the adapter or `window.electronAPI`) as needed

## Input Dependencies
- Task 2: `useDragSelection` hook
- Task 3: `useExpandContext` hook
- Task 4: `FileSection` sub-components (confirms hook interfaces are stable)
- Task 5: `InlineCommentSlot` component

## Output Artifacts
- `packages/react/src/components/DiffViewer/useDragSelection.test.ts`
- `packages/react/src/components/DiffViewer/useExpandContext.test.ts`
- `packages/react/src/components/DiffViewer/InlineCommentSlot.test.tsx`

## Implementation Notes

<details>
<summary>Meaningful Test Strategy Guidelines</summary>

Your critical mantra is: "write a few tests, mostly integration".

**Focus on:**
- Custom hook state transitions and side effects (drag state machine, expand loading state)
- Integration between hook logic and DOM events (drag selection via mouse events, custom events)
- `InlineCommentSlot` rendering based on props (show/hide comment input, indent class application)

**Do NOT test:**
- React's `useState` or `useEffect` mechanics
- That shadcn/ui components render correctly
- Third-party library behaviour (MDEditor, Prism)

**For `useDragSelection` tests:**
- Use `renderHook` and simulate `mousedown`/`mousemove`/`mouseup` events
- Test the state machine: idle → dragging → range committed
- Test that `trigger-line-comment` custom event triggers range initiation

**For `useExpandContext` tests:**
- Mock `window.electronAPI.loadFileHunks` (or whatever IPC method is called)
- Test that `expandLoading` transitions correctly
- Test budget tracking for hunk trimming if the logic is non-trivial

**For `InlineCommentSlot` tests:**
- Render with `commentsToRender` and assert `CommentDisplay` count
- Render with `showCommentInput: true` and assert `CommentInput` appears
- Render with `indentClass` and assert the CSS class is applied

**Keep test count minimal**: 3-5 tests per file is sufficient. Avoid testing every prop combination.

</details>
