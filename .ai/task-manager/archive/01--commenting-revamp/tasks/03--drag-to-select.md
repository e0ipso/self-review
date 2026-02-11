---
id: 3
group: "interaction-model"
dependencies: [2]
status: "completed"
created: "2026-02-11"
skills:
  - react-components
  - css
complexity_score: 5
complexity_notes: "Most complex task: document-level event listeners, hunk boundary lookup map, drag state machine, visual feedback. Well-scoped to interaction layer only."
---
# Implement Drag-to-Select Multi-Line Comments with Hunk Boundary Constraints

## Objective
Implement a drag interaction starting from the "+" icon that allows selecting a range of lines for multi-line comments. The drag is constrained to lines within a single hunk and the same side (old/new). Visual feedback highlights lines during the drag. A single click (mousedown + mouseup on same line) is the degenerate case producing a single-line comment.

## Skills Required
- `react-components`: Document-level event listeners, state-driven UI, hunk-to-line mapping
- `css`: Dynamic highlight classes during drag (Tailwind)

## Acceptance Criteria
- [ ] `mousedown` on the "+" icon initiates a drag (sets drag start line)
- [ ] `mousemove` on the document tracks the current hovered line and updates visual feedback
- [ ] `mouseup` on the document commits the range and opens CommentInput
- [ ] Single click (mousedown + mouseup on same icon) opens CommentInput for that single line
- [ ] Drag is constrained to lines within the same hunk (cannot span @@ boundaries)
- [ ] Drag is constrained to the same side (old/new) in split view
- [ ] Lines within the current drag range are highlighted with `bg-blue-100 dark:bg-blue-900/30`
- [ ] Dragging up (from line 10 to line 5) works correctly (range is min to max)
- [ ] Visual feedback clears when drag ends or is cancelled
- [ ] Text selection is prevented during drag (`user-select: none` or `e.preventDefault()`)

## Technical Requirements
- Modify `src/renderer/components/DiffViewer/FileSection.tsx` (drag state management, hunk boundary logic)
- Modify `src/renderer/components/DiffViewer/SplitView.tsx` (icon mousedown handler, line data attributes, visual feedback)
- Modify `src/renderer/components/DiffViewer/UnifiedView.tsx` (same as SplitView)

## Input Dependencies
- Task 1: Unified state model with `dragState` in FileSection
- Task 2: "+" icon in gutter as the drag start element

## Output Artifacts
- Functional drag-to-select interaction in both SplitView and UnifiedView
- Hunk boundary constraint logic in FileSection
- Visual feedback during drag

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Hunk boundary lookup map

In `FileSection`, build a lookup map that maps `(lineNumber, side)` to a hunk index. This allows clamping the drag end line to the same hunk as the start line.

```tsx
const buildHunkLineMap = (file: DiffFile): Map<string, { hunkIndex: number; minLine: number; maxLine: number }> => {
  const map = new Map<string, { hunkIndex: number; minLine: number; maxLine: number }>();
  file.hunks.forEach((hunk, hunkIndex) => {
    let minOld = Infinity, maxOld = -Infinity;
    let minNew = Infinity, maxNew = -Infinity;
    for (const line of hunk.lines) {
      if (line.oldLineNumber !== null) {
        minOld = Math.min(minOld, line.oldLineNumber);
        maxOld = Math.max(maxOld, line.oldLineNumber);
      }
      if (line.newLineNumber !== null) {
        minNew = Math.min(minNew, line.newLineNumber);
        maxNew = Math.max(maxNew, line.newLineNumber);
      }
    }
    // Store range for each hunk
    for (const line of hunk.lines) {
      if (line.oldLineNumber !== null) {
        map.set(`old-${line.oldLineNumber}`, { hunkIndex, minLine: minOld, maxLine: maxOld });
      }
      if (line.newLineNumber !== null) {
        map.set(`new-${line.newLineNumber}`, { hunkIndex, minLine: minNew, maxLine: maxNew });
      }
    }
  });
  return map;
};
```

Use `useMemo` to compute this once per file render:
```tsx
const hunkLineMap = useMemo(() => buildHunkLineMap(file), [file]);
```

### Drag event handling in FileSection

```tsx
// Start drag
const handleDragStart = (lineNumber: number, side: 'old' | 'new') => {
  setDragState({ startLine: lineNumber, currentLine: lineNumber, side });
};

// Update drag (called from document mousemove via data attributes)
const handleDragMove = (lineNumber: number, side: 'old' | 'new') => {
  if (!dragState || dragState.side !== side) return;

  // Clamp to same hunk
  const startKey = `${dragState.side}-${dragState.startLine}`;
  const hunkInfo = hunkLineMap.get(startKey);
  if (!hunkInfo) return;

  const clampedLine = Math.max(hunkInfo.minLine, Math.min(hunkInfo.maxLine, lineNumber));
  setDragState(prev => prev ? { ...prev, currentLine: clampedLine } : null);
};

// End drag
const handleDragEnd = () => {
  if (dragState) {
    const start = Math.min(dragState.startLine, dragState.currentLine);
    const end = Math.max(dragState.startLine, dragState.currentLine);
    setCommentRange({ start, end, side: dragState.side });
  }
  setDragState(null);
};
```

### Document-level event listeners

When drag starts, attach `mousemove` and `mouseup` listeners to `document`. Use `useEffect` with cleanup:

```tsx
useEffect(() => {
  if (!dragState) return;

  const handleMouseMove = (e: MouseEvent) => {
    // Find the line element under the cursor using data attributes
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const lineEl = target?.closest('[data-line-number]');
    if (lineEl) {
      const lineNumber = parseInt(lineEl.getAttribute('data-line-number')!, 10);
      const side = lineEl.getAttribute('data-line-side') as 'old' | 'new';
      if (side === dragState.side) {
        handleDragMove(lineNumber, side);
      }
    }
  };

  const handleMouseUp = () => {
    handleDragEnd();
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  return () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}, [dragState, hunkLineMap]);
```

### Data attributes on line rows

In both SplitView and UnifiedView, add `data-line-number` and `data-line-side` attributes to the line row divs or gutter cells so that `elementFromPoint` can identify lines during drag:

```tsx
<div
  className={`...`}
  data-line-number={lineNumber}
  data-line-side={side}
>
```

### Visual feedback

Update the `isLineHighlighted` logic in both views to check `dragState`:

```tsx
const isLineHighlighted = (lineNumber: number, side: 'old' | 'new') => {
  // Check committed comment range
  if (commentRange && commentRange.side === side) {
    if (lineNumber >= commentRange.start && lineNumber <= commentRange.end) return true;
  }
  // Check in-progress drag
  if (dragState && dragState.side === side) {
    const min = Math.min(dragState.startLine, dragState.currentLine);
    const max = Math.max(dragState.startLine, dragState.currentLine);
    if (lineNumber >= min && lineNumber <= max) return true;
  }
  return false;
};
```

Apply the highlight class: `bg-blue-100 dark:bg-blue-900/30`

### Icon mousedown handler

In SplitView/UnifiedView, the "+" icon gets a `mousedown` handler instead of (or in addition to) `click`:

```tsx
<button
  onMouseDown={(e) => {
    e.preventDefault(); // Prevent text selection
    onDragStart(lineNumber, side);
  }}
  ...
>
```

The `click` event is no longer needed separately — the mouseup handler in FileSection will detect if it's a single click (start === current) and treat it as a single-line range.

### Prevent text selection during drag

Add to the root div of FileSection during drag:
```tsx
<div className={`... ${dragState ? 'select-none' : ''}`}>
```

</details>
