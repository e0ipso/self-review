---
id: 4
group: "review-bridge"
dependencies: [2, 3]
status: "completed"
created: 2026-03-14
skills:
  - typescript
  - jest
---
# Update Package Exports and Write Unit Tests

## Objective

Export the new `ReviewHandle` and `SingleFileReviewHandle` types from `packages/react/src/index.ts`, and write unit tests for `useReviewBridge` verifying the callback fires on comment changes and the ref handle returns correct state.

## Skills Required

- typescript: barrel exports
- jest: Vitest unit tests with `renderHook`, mock context

## Acceptance Criteria

- [ ] `index.ts` exports `ReviewHandle` type from `./hooks/useReviewBridge`
- [ ] `index.ts` exports `SingleFileReviewHandle` type from `./SingleFileReview`
- [ ] Unit test file `packages/react/src/hooks/useReviewBridge.test.ts` is created
- [ ] Test: `onReviewChange` is called with the current flat comment array when comments change
- [ ] Test: `onReviewChange` is NOT called when it is not provided (no error)
- [ ] Test: ref handle's `getReviewState()` returns correct `files`, `source`, and a `timestamp`
- [ ] All existing unit tests continue to pass (`npm run test:unit`)

## Technical Requirements

- Tests use Vitest (`describe`, `it`, `expect`, `vi`)
- Tests mock `useReview` from `../context/ReviewContext` to control `files` and `diffSource`
- Use `renderHook` from `@testing-library/react` to test the hook in isolation
- `useImperativeHandle` requires a real ref created with `React.createRef<ReviewHandle>()`

## Input Dependencies

- Task 02: `SingleFileReviewHandle` exported from `SingleFileReview.tsx`
- Task 03: `ReviewPanel.tsx` updated (no direct artifact needed for exports, but both tasks must be done before testing the integrated behaviour)

## Output Artifacts

- Updated `packages/react/src/index.ts` with two new type exports
- New `packages/react/src/hooks/useReviewBridge.test.ts`

## Implementation Notes

<details>
<summary>Implementation details</summary>

### index.ts additions

Add to the exports section (near the existing `ReviewPanelHandle` export):
```ts
export type { ReviewHandle } from './hooks/useReviewBridge';
export type { SingleFileReviewHandle } from './SingleFileReview';
```

### useReviewBridge.test.ts structure

```ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { useReviewBridge, type ReviewHandle } from './useReviewBridge';

// Mock useReview
vi.mock('../context/ReviewContext', () => ({
  useReview: vi.fn(),
}));

import { useReview } from '../context/ReviewContext';

const mockDiffSource = { type: 'git' as const, args: [] };

function makeFile(comments: any[]) {
  return { newPath: 'file.ts', comments, hunks: [], changeType: 'modified' } as any;
}
```

**Test 1 — callback fires with flat comments:**
```ts
it('calls onReviewChange with flat comments when files change', () => {
  const comment = { id: '1', body: 'hi' } as any;
  vi.mocked(useReview).mockReturnValue({
    files: [makeFile([comment])],
    diffSource: mockDiffSource,
  } as any);

  const onReviewChange = vi.fn();
  const ref = React.createRef<ReviewHandle>();
  renderHook(() => useReviewBridge(ref, onReviewChange));

  expect(onReviewChange).toHaveBeenCalledWith([comment]);
});
```

**Test 2 — no callback = no error:**
```ts
it('does not throw when onReviewChange is undefined', () => {
  vi.mocked(useReview).mockReturnValue({
    files: [makeFile([])],
    diffSource: mockDiffSource,
  } as any);
  const ref = React.createRef<ReviewHandle>();
  expect(() => renderHook(() => useReviewBridge(ref, undefined))).not.toThrow();
});
```

**Test 3 — ref handle returns state:**
```ts
it('ref handle getReviewState returns current files and source', () => {
  const file = makeFile([]);
  vi.mocked(useReview).mockReturnValue({
    files: [file],
    diffSource: mockDiffSource,
  } as any);
  const ref = React.createRef<ReviewHandle>();
  renderHook(() => useReviewBridge(ref, undefined));

  const state = ref.current?.getReviewState();
  expect(state?.files).toEqual([file]);
  expect(state?.source).toEqual(mockDiffSource);
  expect(typeof state?.timestamp).toBe('string');
});
```

Keep tests focused on the hook's contract. Don't test React internals.

</details>
