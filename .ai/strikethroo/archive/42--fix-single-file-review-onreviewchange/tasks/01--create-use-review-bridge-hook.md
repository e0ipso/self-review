---
id: 1
group: "review-bridge"
dependencies: []
status: "completed"
created: 2026-03-14
skills:
  - react-components
  - typescript
---
# Create useReviewBridge Hook

## Objective

Create a new shared hook `useReviewBridge` in `packages/react/src/hooks/useReviewBridge.ts` that encapsulates both consumer access patterns (imperative ref handle + reactive callback). Also define the shared `ReviewHandle` interface in this file.

## Skills Required

- react-components: `forwardRef`, `useImperativeHandle`, `useEffect`, `useMemo`, `useRef`
- typescript: strict types, `ForwardedRef`, type aliases

## Acceptance Criteria

- [ ] `packages/react/src/hooks/useReviewBridge.ts` is created
- [ ] `ReviewHandle` interface is exported from that file with a single `getReviewState(): ReviewState` method
- [ ] `useReviewBridge(ref, onReviewChange?)` hook is exported from that file
- [ ] The hook calls `useReview()` to read `files` and `diffSource`
- [ ] The hook exposes `getReviewState()` via `useImperativeHandle` (no-ops when ref is null/undefined)
- [ ] The hook fires `onReviewChange(comments)` via `useEffect` whenever `files` changes (skipped when callback is undefined)
- [ ] Flat `comments` array is derived via `useMemo(() => files.flatMap(f => f.comments), [files])`
- [ ] `diffSource` and `files` are stored in refs so `getReviewState()` always returns the latest values without stale closures
- [ ] Hook has no return value (returns `void`)

## Technical Requirements

- Import `useReview` from `../context/ReviewContext`
- Import `ReviewState`, `ReviewComment` from `@self-review/types`
- Import `ForwardedRef`, `useImperativeHandle`, `useEffect`, `useMemo`, `useRef` from `react`
- `ReviewHandle` is the canonical shared type; both `ReviewPanelHandle` and `SingleFileReviewHandle` will become type aliases for it

## Input Dependencies

None — this is the foundation task.

## Output Artifacts

- `packages/react/src/hooks/useReviewBridge.ts` — exported `ReviewHandle` interface and `useReviewBridge` hook

## Implementation Notes

<details>
<summary>Implementation details</summary>

Create `packages/react/src/hooks/useReviewBridge.ts` with this exact structure:

```ts
import { useEffect, useImperativeHandle, useMemo, useRef, type ForwardedRef } from 'react';
import type { ReviewComment, ReviewState } from '@self-review/types';
import { useReview } from '../context/ReviewContext';

export interface ReviewHandle {
  /** Return the current review state (comments, viewed flags, source metadata). */
  getReviewState: () => ReviewState;
}

/**
 * Bridges ReviewProvider context state to both consumer access patterns:
 * - Imperative ref handle (`ref.current.getReviewState()`)
 * - Reactive callback (`onReviewChange(comments)`)
 *
 * Must be called from a component that is inside the ReviewProvider tree.
 */
export function useReviewBridge(
  ref: ForwardedRef<ReviewHandle>,
  onReviewChange?: (comments: ReviewComment[]) => void,
): void {
  const { files, diffSource } = useReview();

  // Stable refs so getReviewState() never closes over stale values
  const filesRef = useRef(files);
  const diffSourceRef = useRef(diffSource);
  filesRef.current = files;
  diffSourceRef.current = diffSource;

  useImperativeHandle(ref, () => ({
    getReviewState: (): ReviewState => ({
      timestamp: new Date().toISOString(),
      source: diffSourceRef.current,
      files: filesRef.current,
    }),
  }));

  const comments = useMemo(
    () => files.flatMap((f) => f.comments),
    [files],
  );

  useEffect(() => {
    if (onReviewChange) {
      onReviewChange(comments);
    }
  }, [comments, onReviewChange]);
}
```

Note: `useImperativeHandle` is safe to call even when `ref` is `null` — React simply ignores it in that case. No conditional logic needed.

</details>
