---
id: 1
group: "interaction-model"
dependencies: []
status: "completed"
created: "2026-02-11"
skills:
  - react-components
complexity_score: 4
complexity_notes: "Moderate refactor touching FileSection state + prop interfaces for SplitView/UnifiedView. No new UI, just state plumbing."
---
# Unify Comment State in FileSection and Refactor View Props

## Objective
Replace the dual `commentingLine` and `selectionRange` states in `FileSection` with a single unified `commentRange` state. Lift the duplicated drag state (`rangeStart`, `handleLineMouseDown`, `handleLineMouseUp`) from `SplitView` and `UnifiedView` into `FileSection`. Update all prop interfaces accordingly. Ensure comment input closes after saving (not just on cancel).

## Skills Required
- `react-components`: React state management, prop drilling, TypeScript interfaces

## Acceptance Criteria
- [ ] `FileSection` uses a single `commentRange: { start: number; end: number; side: 'old' | 'new' } | null` state instead of `commentingLine` + `selectionRange`
- [ ] `handleLineClick` sets `commentRange` with `start === end`
- [ ] A new `handleCommentRange(start, end, side)` replaces both click and range-select handlers
- [ ] Drag state (`rangeStart` and its handlers) is removed from both `SplitView` and `UnifiedView`
- [ ] `FileSection` manages drag state and passes it down as props
- [ ] `SplitView` and `UnifiedView` prop interfaces are updated to use the new state model
- [ ] Comment input closes after saving (pass `onSubmit` to `CommentInput` that clears `commentRange`)
- [ ] Existing single-line and multi-line comment functionality still works (no behavioral regression)
- [ ] The comment input renders below the last line of the `commentRange`

## Technical Requirements
- Modify `src/renderer/components/DiffViewer/FileSection.tsx`
- Modify `src/renderer/components/DiffViewer/SplitView.tsx` (remove internal drag state, update props interface)
- Modify `src/renderer/components/DiffViewer/UnifiedView.tsx` (remove internal drag state, update props interface)
- No changes to shared types, IPC, or main process

## Input Dependencies
None — this is the foundational refactor.

## Output Artifacts
- Updated `FileSection.tsx` with unified `commentRange` state and drag state management
- Updated `SplitViewProps` and `UnifiedViewProps` interfaces
- Updated `SplitView.tsx` and `UnifiedView.tsx` with removed internal state and new prop consumption

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### FileSection.tsx changes

1. **Replace state declarations** (around line 26-27):
```tsx
// REMOVE:
const [commentingLine, setCommentingLine] = useState<{ lineNumber: number; side: 'old' | 'new' } | null>(null);
const [selectionRange, setSelectionRange] = useState<{ start: number; end: number; side: 'old' | 'new' } | null>(null);

// ADD:
const [commentRange, setCommentRange] = useState<{ start: number; end: number; side: 'old' | 'new' } | null>(null);
const [dragState, setDragState] = useState<{ startLine: number; currentLine: number; side: 'old' | 'new' } | null>(null);
```

2. **Update handlers** (around lines 55-68):
```tsx
// Unified handler for both single-line clicks and range selections
const handleCommentRange = (start: number, end: number, side: 'old' | 'new') => {
  setCommentRange({ start: Math.min(start, end), end: Math.max(start, end), side });
  setDragState(null);
};

const handleCancelComment = () => {
  setCommentRange(null);
  setDragState(null);
};

// Close comment input after saving
const handleCommentSaved = () => {
  setCommentRange(null);
};

// Drag state handlers to pass down
const handleDragStart = (lineNumber: number, side: 'old' | 'new') => {
  setDragState({ startLine: lineNumber, currentLine: lineNumber, side });
};

const handleDragMove = (lineNumber: number) => {
  setDragState(prev => prev ? { ...prev, currentLine: lineNumber } : null);
};

const handleDragEnd = (lineNumber: number, side: 'old' | 'new') => {
  if (dragState && dragState.side === side) {
    const start = Math.min(dragState.startLine, lineNumber);
    const end = Math.max(dragState.startLine, lineNumber);
    handleCommentRange(start, end, side);
  }
  setDragState(null);
};
```

3. **Update props passed to SplitView/UnifiedView**:
```tsx
<SplitView
  file={file}
  commentRange={commentRange}
  dragState={dragState}
  onCommentRange={handleCommentRange}
  onDragStart={handleDragStart}
  onDragMove={handleDragMove}
  onDragEnd={handleDragEnd}
  onCancelComment={handleCancelComment}
  onCommentSaved={handleCommentSaved}
/>
```

4. **Update CommentInput rendering in SplitView/UnifiedView**: The comment input should appear below the last line of `commentRange`. Pass `onSubmit={onCommentSaved}` to CommentInput. The `lineRange` prop for CommentInput is derived from `commentRange`: `{ side: commentRange.side, start: commentRange.start, end: commentRange.end }`.

### SplitView.tsx / UnifiedView.tsx changes

1. **Update props interface**:
```tsx
export interface SplitViewProps {
  file: DiffFile;
  commentRange: { start: number; end: number; side: 'old' | 'new' } | null;
  dragState: { startLine: number; currentLine: number; side: 'old' | 'new' } | null;
  onCommentRange: (start: number, end: number, side: 'old' | 'new') => void;
  onDragStart: (lineNumber: number, side: 'old' | 'new') => void;
  onDragMove: (lineNumber: number) => void;
  onDragEnd: (lineNumber: number, side: 'old' | 'new') => void;
  onCancelComment: () => void;
  onCommentSaved: () => void;
}
```

2. **Remove internal state**: Delete the `rangeStart` state, `handleLineMouseDown`, and `handleLineMouseUp` functions from both views.

3. **Update `isLineSelected`**: Check against `commentRange` (for committed selection) and `dragState` (for in-progress drag visual feedback).

4. **Update comment input rendering logic**: Instead of checking `commentingLine`, check `commentRange`. Show CommentInput below the row containing `commentRange.end` on the matching side. Pass `onSubmit={onCommentSaved}` to CommentInput.

5. **Keep line number gutter events**: For now, keep the existing `onMouseDown`/`onMouseUp`/`onClick` on line numbers wired to the new lifted handlers (`onDragStart`/`onDragEnd`/`onCommentRange`). The icon-based interaction will be added in Task 2.

</details>
