---
id: 2
group: "interaction-model"
dependencies: [1]
status: "pending"
created: "2026-02-11"
skills:
  - react-components
  - css
---
# Add Hover "+" Icon to Gutter for Comment Activation

## Objective
Add a "+" icon to the line number gutter that appears on hover and serves as the single click target for comment activation. Remove the current line-number-click interaction. The icon appears only on cells with a valid line number (no icon on empty padding cells in split view).

## Skills Required
- `react-components`: Icon rendering, event handlers
- `css`: Hover states with Tailwind utilities (opacity-0 group-hover:opacity-100)

## Acceptance Criteria
- [ ] A "+" icon (using lucide-react `Plus` or `MessageSquarePlus`) is rendered in the line number gutter cell
- [ ] The icon is hidden by default and shown on hover (CSS opacity transition)
- [ ] Clicking the icon opens a comment input for that single line (calls `onCommentRange(line, line, side)`)
- [ ] Line number text is no longer clickable (just a display element)
- [ ] In split view, empty padding cells (no line number) have no icon
- [ ] In unified view, only one icon per line row (on the relevant side gutter)
- [ ] The icon appears in both SplitView and UnifiedView
- [ ] Existing mousedown/mouseup handlers on line numbers are removed (drag will be handled via the icon in Task 3)

## Technical Requirements
- Modify `src/renderer/components/DiffViewer/SplitView.tsx`
- Modify `src/renderer/components/DiffViewer/UnifiedView.tsx`
- Use lucide-react icon (already installed in the project)
- Use Tailwind utility classes for hover animation

## Input Dependencies
- Task 1: Unified `commentRange` state and refactored props in FileSection

## Output Artifacts
- Updated `SplitView.tsx` with "+" icon in gutter cells
- Updated `UnifiedView.tsx` with "+" icon in gutter cells

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Gutter cell structure (SplitView)

In `renderLineCell` (around line 85-123 of SplitView.tsx), restructure the gutter div:

```tsx
{/* Line number gutter */}
<div className={`w-10 flex-shrink-0 text-right pr-2 text-[11px] leading-[22px] text-muted-foreground/70 select-none ${getGutterBg(line)} group/gutter relative`}>
  {lineNumber && (
    <button
      className="absolute left-0 top-0 bottom-0 flex items-center justify-center w-5 opacity-0 group-hover/gutter:opacity-100 transition-opacity text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400"
      onClick={(e) => {
        e.stopPropagation();
        onCommentRange(lineNumber, lineNumber, side);
      }}
      data-testid={`comment-icon-${side}-${lineNumber}`}
    >
      <Plus className="h-3.5 w-3.5" />
    </button>
  )}
  <span className="pointer-events-none">{lineNumber || ''}</span>
</div>
```

Key changes:
- Remove `cursor-pointer`, `hover:text-foreground` from the gutter div
- Remove `onClick`, `onMouseDown`, `onMouseUp` from the gutter div
- Add `group/gutter` and `relative` to the gutter div for scoping the hover
- Add the icon button positioned absolutely on the left side
- The line number text gets `pointer-events-none` since it's display-only
- Add `data-testid` for the icon for future testing

### Gutter cell structure (UnifiedView)

In UnifiedView, there are two gutter columns (old line number, new line number). Only one should have the icon:
- For **deletion** lines: icon goes on the old line number gutter
- For **addition** lines: icon goes on the new line number gutter
- For **context** lines: icon goes on the new line number gutter (convention: comment on the new side for context)

Alternatively, add the icon to both gutters where a line number exists, but only show it on the "active" side for the line type. The simplest approach: add the icon to any gutter cell that has a line number, since the `onCommentRange` already takes the `side` parameter.

```tsx
{/* Old line number */}
<div className={`w-10 flex-shrink-0 text-right pr-2 text-[11px] leading-[22px] text-muted-foreground/70 select-none ${getGutterBg(line)} group/gutter-old relative`}>
  {line.oldLineNumber && (
    <button
      className="absolute left-0 top-0 bottom-0 flex items-center justify-center w-5 opacity-0 group-hover/gutter-old:opacity-100 transition-opacity text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400"
      onClick={(e) => {
        e.stopPropagation();
        onCommentRange(line.oldLineNumber!, line.oldLineNumber!, 'old');
      }}
      data-testid={`comment-icon-old-${line.oldLineNumber}`}
    >
      <Plus className="h-3.5 w-3.5" />
    </button>
  )}
  <span className="pointer-events-none">{line.oldLineNumber || ''}</span>
</div>
```

Do the same for the new line number gutter. For deletion lines, only the old gutter has a number (and thus an icon). For addition lines, only the new gutter has a number. For context lines, both have numbers and both get icons.

### Import

Add to both files:
```tsx
import { Plus } from 'lucide-react';
```

### Removing old click handlers

Remove the `onClick`, `onMouseDown`, `onMouseUp` props from the gutter `div` elements. All interaction goes through the icon button.

</details>
