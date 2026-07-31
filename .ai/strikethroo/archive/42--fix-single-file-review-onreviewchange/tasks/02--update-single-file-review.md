---
id: 2
group: "review-bridge"
dependencies: [1]
status: "completed"
created: 2026-03-14
skills:
  - react-components
  - typescript
---
# Update SingleFileReview Component

## Objective

Fix `SingleFileReview` so the `onReviewChange` prop actually fires, and add an imperative ref handle by converting the component to use `forwardRef` + the new `useReviewBridge` hook via a `SingleFileReviewInner` child component. Export `SingleFileReviewHandle` as a type alias.

## Skills Required

- react-components: `forwardRef`, inner-component pattern
- typescript: type aliases, `forwardRef` typing

## Acceptance Criteria

- [ ] `onReviewChange: _onReviewChange` rename is removed — the prop is used directly
- [ ] `SingleFileReview` is converted to `forwardRef<ReviewHandle, SingleFileReviewProps>`
- [ ] A `SingleFileReviewInner` component is added inside `SingleFileReview.tsx`; it lives inside the provider tree and calls `useReviewBridge(ref, onReviewChange)`
- [ ] `SingleFileReviewInner` renders the same `<div className={className}><FileSection .../></div>` as before
- [ ] `SingleFileReviewHandle` is exported from `SingleFileReview.tsx` as `export type SingleFileReviewHandle = ReviewHandle`
- [ ] The `onReviewChange` prop remains optional — no behaviour change when omitted
- [ ] No ref is required by consumers — backwards-compatible

## Technical Requirements

- Import `forwardRef` from `react`
- Import `ReviewHandle`, `useReviewBridge` from `./hooks/useReviewBridge`
- `SingleFileReviewInner` must be defined as a `forwardRef` component that accepts `{ onReviewChange, className, file, viewMode }` (or similar minimal props) so the outer component can forward its `ref` to it

## Input Dependencies

- Task 01: `useReviewBridge` hook and `ReviewHandle` type from `packages/react/src/hooks/useReviewBridge.ts`

## Output Artifacts

- Updated `packages/react/src/SingleFileReview.tsx` with working `onReviewChange` and ref handle
- Exported `SingleFileReviewHandle` type alias

## Implementation Notes

<details>
<summary>Implementation details</summary>

The key structural change: the `<div>` + `<FileSection>` currently rendered directly inside `SingleFileReview` must move into a `SingleFileReviewInner` component that lives inside all providers, so it can call `useReviewBridge`.

```tsx
// SingleFileReviewInner — lives inside all providers
interface SingleFileReviewInnerProps {
  file: DiffFile;
  viewMode: 'split' | 'unified';
  onReviewChange?: (comments: ReviewComment[]) => void;
  className?: string;
}

const SingleFileReviewInner = forwardRef<ReviewHandle, SingleFileReviewInnerProps>(
  function SingleFileReviewInner({ file, viewMode, onReviewChange, className }, ref) {
    useReviewBridge(ref, onReviewChange);
    return (
      <div className={className}>
        <FileSection file={file} viewMode={viewMode} expanded={true} />
      </div>
    );
  },
);
```

Then in the main `SingleFileReview` forwardRef wrapper, render:
```tsx
<TooltipProvider>
  <SingleFileReviewInner
    ref={ref}
    file={file}
    viewMode={defaultViewMode}
    onReviewChange={onReviewChange}
    className={className}
  />
</TooltipProvider>
```

Remove `onReviewChange: _onReviewChange` from the destructuring — use `onReviewChange` directly.

Export type alias at the bottom of the file (before or after the component):
```ts
export type SingleFileReviewHandle = ReviewHandle;
```

</details>
