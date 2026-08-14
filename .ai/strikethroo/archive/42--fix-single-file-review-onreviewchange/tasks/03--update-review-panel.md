---
id: 3
group: "review-bridge"
dependencies: [1]
status: "completed"
created: 2026-03-14
skills:
  - react-components
  - typescript
---
# Update ReviewPanel Component

## Objective

Add `onReviewChange` prop to `ReviewPanel` and replace the manual `useReview()` + `useImperativeHandle` + refs logic in `ReviewPanelInner` with a single `useReviewBridge` call. Make `ReviewPanelHandle` a type alias for `ReviewHandle` (backwards-compatible).

## Skills Required

- react-components: `forwardRef`, `useImperativeHandle` (removal), hook composition
- typescript: type aliases for backwards compatibility

## Acceptance Criteria

- [ ] `ReviewPanelProps` gains `onReviewChange?: (comments: ReviewComment[]) => void`
- [ ] `ReviewPanelInner` passes both `ref` and `onReviewChange` to `useReviewBridge`
- [ ] The manual `useRef(files)`, `useRef(diffSource)`, and `useImperativeHandle` blocks are removed from `ReviewPanelInner` (replaced by the hook)
- [ ] `ReviewPanelHandle` is changed to `export type ReviewPanelHandle = ReviewHandle` (type alias, not a new interface) — existing consumers using `ReviewPanelHandle` see no API change
- [ ] `ReviewPanel` forwards `onReviewChange` into `ReviewPanelInner`
- [ ] When `onReviewChange` is not passed, behaviour is identical to today

## Technical Requirements

- Import `ReviewHandle`, `useReviewBridge` from `./hooks/useReviewBridge`
- Remove the local `useRef` / `useImperativeHandle` blocks from `ReviewPanelInner`
- Add `onReviewChange` to the `ReviewPanelInner` props interface
- Keep `ReviewPanelHandle` exported (as a type alias) for backwards compatibility

## Input Dependencies

- Task 01: `useReviewBridge` hook and `ReviewHandle` type from `packages/react/src/hooks/useReviewBridge.ts`

## Output Artifacts

- Updated `packages/react/src/ReviewPanel.tsx` with `onReviewChange` support and simplified `ReviewPanelInner`

## Implementation Notes

<details>
<summary>Implementation details</summary>

In `ReviewPanel.tsx`:

1. Change `ReviewPanelHandle` from an interface to a type alias:
   ```ts
   // Before:
   export interface ReviewPanelHandle {
     getReviewState: () => ReviewState;
   }
   // After:
   import type { ReviewHandle } from './hooks/useReviewBridge';
   export type ReviewPanelHandle = ReviewHandle;
   ```

2. Add `onReviewChange` to `ReviewPanelProps`:
   ```ts
   onReviewChange?: (comments: ReviewComment[]) => void;
   ```

3. In `ReviewPanelInner`, replace the manual ref logic:
   ```ts
   // Remove these lines:
   const { files, diffSource } = useReview();
   const filesRef = useRef(files);
   const diffSourceRef = useRef(diffSource);
   filesRef.current = files;
   diffSourceRef.current = diffSource;
   useImperativeHandle(ref, () => ({ ... }));

   // Replace with:
   useReviewBridge(ref, onReviewChange);
   ```

4. Update `ReviewPanelInner` props to include `onReviewChange`, and pass it from the outer `ReviewPanel` forwardRef wrapper.

The `useRef` and `useImperativeHandle` imports can be removed from `ReviewPanel.tsx` if no longer used elsewhere in that file. `useReview` import can also be removed.

</details>
