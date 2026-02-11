---
id: 4
group: "comment-ui"
dependencies: []
status: "completed"
created: "2026-02-11"
skills:
  - react-components
---
# Add Line Range Headers to CommentInput and CommentDisplay

## Objective
Display a small header in both the comment input box and the rendered comment card indicating which lines the comment applies to. For example: "Comment on line 13" or "Comment on lines 6 to 10". File-level comments (lineRange is null) show no header.

## Skills Required
- `react-components`: Simple conditional rendering, prop consumption

## Acceptance Criteria
- [ ] `CommentInput` shows a header above the textarea: "Comment on line X" (single line) or "Comment on lines X to Y" (range)
- [ ] `CommentDisplay` shows a similar header indicating the line range
- [ ] File-level comments (lineRange is null) show no line range header
- [ ] The header text is styled subtly (small font, muted color) to not distract from the comment body
- [ ] Header correctly handles single-line case (start === end) vs multi-line case

## Technical Requirements
- Modify `src/renderer/components/Comments/CommentInput.tsx`
- Modify `src/renderer/components/Comments/CommentDisplay.tsx`
- No new dependencies

## Input Dependencies
None — uses the existing `lineRange` prop/field which is already part of the data model.

## Output Artifacts
- Updated `CommentInput.tsx` with line range header
- Updated `CommentDisplay.tsx` with line range header

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Helper function (can be inline or shared)

```tsx
const formatLineRange = (lineRange: LineRange | null): string | null => {
  if (!lineRange) return null;
  if (lineRange.start === lineRange.end) {
    return `Comment on line ${lineRange.start}`;
  }
  return `Comment on lines ${lineRange.start} to ${lineRange.end}`;
};
```

### CommentInput.tsx changes

Add the header above the textarea (around line 78-86, inside the card div, before the `<div className="p-3">` that contains the textarea):

```tsx
<div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden" data-testid="comment-input">
  {lineRange && (
    <div className="px-3 pt-2 pb-0">
      <span className="text-xs font-medium text-muted-foreground">
        {lineRange.start === lineRange.end
          ? `Comment on line ${lineRange.start}`
          : `Comment on lines ${lineRange.start} to ${lineRange.end}`}
      </span>
    </div>
  )}
  <div className="p-3">
    <Textarea ... />
  </div>
  ...
</div>
```

### CommentDisplay.tsx changes

Add the line range header in the comment card header area (around line 52-74). Place it alongside or below the "You" label and category badge:

```tsx
<div className="flex items-center justify-between px-3 py-2">
  <div className="flex items-center gap-2">
    <span className="text-xs font-semibold text-foreground">You</span>
    {comment.lineRange && (
      <span className="text-[11px] text-muted-foreground">
        {comment.lineRange.start === comment.lineRange.end
          ? `line ${comment.lineRange.start}`
          : `lines ${comment.lineRange.start}\u2013${comment.lineRange.end}`}
      </span>
    )}
    {comment.category && (
      <Badge ...>
        {comment.category}
      </Badge>
    )}
    ...
  </div>
  ...
</div>
```

Use an en-dash (–) or "to" for the range separator. Match the inspiration screenshot style.

</details>
