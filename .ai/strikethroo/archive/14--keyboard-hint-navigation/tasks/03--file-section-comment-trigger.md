---
id: 3
group: 'foundation'
dependencies: []
status: 'completed'
created: '2026-02-16'
skills:
  - react-components
---

# Add Custom Event Listener for Programmatic Comment Triggering

## Objective

Enable the keyboard hint system to programmatically open a comment input on a specific diff line by dispatching a custom DOM event (`trigger-line-comment`), which `FileSection` listens for and converts into a comment range.

## Skills Required

React components with DOM event integration.

## Acceptance Criteria

- [ ] `FileSection.tsx` listens for a `trigger-line-comment` custom event on its root element
- [ ] When the event fires with `{ filePath, lineNumber, side }` in `detail`, the component sets `commentRange` to `{ start: lineNumber, end: lineNumber, side }` and shows the comment input
- [ ] The handler ignores events if a drag operation is in progress
- [ ] The handler ignores events if the `filePath` doesn't match the component's file
- [ ] Existing mouse-based comment creation still works identically

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- The app already uses custom DOM events for cross-component coordination (`toggle-all-sections`, `toggle-all-comments`)
- `FileSection` manages `commentRange` state and `dragState` — the event handler should check `dragState` is null before proceeding
- The custom event is dispatched on `document` with bubbling, carrying `{ filePath, lineNumber, side }` in `detail`
- `lineNumber` corresponds to the actual line number (old or new depending on side), matching what `data-line-number` contains

## Input Dependencies

None — can be done in parallel with tasks 1 and 2.

## Output Artifacts

`FileSection.tsx` ready to receive programmatic comment triggers from the keyboard hint system (task 4).

## Implementation Notes

<details>

### Event Shape

```typescript
// Dispatched by keyboard hint system:
new CustomEvent('trigger-line-comment', {
  bubbles: true,
  detail: { filePath: string, lineNumber: number, side: 'old' | 'new' }
});
```

### FileSection.tsx Changes

In `src/renderer/components/DiffViewer/FileSection.tsx`, add a `useEffect` that listens for the custom event on `document`:

```tsx
useEffect(() => {
  const handler = (e: Event) => {
    const { filePath: targetFile, lineNumber, side } = (e as CustomEvent).detail;
    // Only handle if this FileSection is for the target file
    if (targetFile !== filePath) return;
    // Don't trigger if a drag is in progress
    if (dragState) return;
    // Set comment range for single-line comment
    setCommentRange({ start: lineNumber, end: lineNumber, side });
  };
  document.addEventListener('trigger-line-comment', handler);
  return () => document.removeEventListener('trigger-line-comment', handler);
}, [filePath, dragState]);
```

Note: Check the existing `handleCommentRange` function (around line 159) — it may be better to call that function if it includes additional logic beyond just `setCommentRange`. Look at what processing `handleCommentRange` does (it might also update `dragState` to null, for instance) and call the appropriate one.

Also look at how `commentRange` is used in the view components (SplitView/UnifiedView) to ensure the `{ start, end, side }` shape from the event matches what's expected.

</details>
