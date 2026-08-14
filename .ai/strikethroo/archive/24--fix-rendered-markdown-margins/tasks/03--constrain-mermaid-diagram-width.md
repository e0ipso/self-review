---
id: 3
group: "rendered-markdown-fixes"
dependencies: []
status: "completed"
created: "2026-02-27"
skills:
  - css
  - react-components
---
# Constrain Mermaid Diagram Width and Overflow

## Objective
Prevent mermaid SVG diagrams from overflowing the content area or creating excessive whitespace by constraining the container and SVG dimensions.

## Skills Required
- css: SVG sizing and overflow behavior
- react-components: Modifying the MermaidBlock component

## Acceptance Criteria
- [ ] Mermaid diagrams render within the content area without horizontal overflow
- [ ] No excessive whitespace around diagrams
- [ ] Large diagrams scale down to fit rather than overflowing
- [ ] Error and loading states are unaffected

## Technical Requirements
- Add `overflow: hidden` and `max-width: 100%` to the MermaidBlock container div
- Ensure the SVG scales properly with `max-width: 100%` and `height: auto`

## Input Dependencies
None — this task is independent.

## Output Artifacts
- Modified `src/renderer/components/DiffViewer/MermaidBlock.tsx` with constrained container styling

## Implementation Notes

<details>
<summary>Detailed implementation steps</summary>

**File to modify**: `src/renderer/components/DiffViewer/MermaidBlock.tsx`

**Current code** (line 47):
```tsx
return <div dangerouslySetInnerHTML={{ __html: svg }} />;
```

**Change to**:
```tsx
return (
  <div
    className="overflow-hidden max-w-full [&>svg]:max-w-full [&>svg]:h-auto"
    dangerouslySetInnerHTML={{ __html: svg }}
  />
);
```

**Explanation of styles**:
- `overflow-hidden` — Prevents any SVG overflow from bleeding out of the container
- `max-w-full` — Constrains the container div to its parent's width
- `[&>svg]:max-w-full` — Tailwind arbitrary selector targeting the direct child SVG element, ensuring it doesn't exceed the container width
- `[&>svg]:h-auto` — Allows the SVG height to scale proportionally when width is constrained

**Alternative approach** (if Tailwind arbitrary selectors don't work well with `dangerouslySetInnerHTML`): Use inline styles instead:

```tsx
return (
  <div
    style={{ overflow: 'hidden', maxWidth: '100%' }}
    className="[&>svg]:max-w-full [&>svg]:h-auto"
    dangerouslySetInnerHTML={{ __html: svg }}
  />
);
```

**Do NOT modify** the error state div (line 40-44) or the loading state div (line 46) — only the success render path on line 47.

**Testing**: Open a markdown file with a mermaid diagram (especially a wide one like a Gantt chart or complex flowchart) in the rendered view. The diagram should fit within the content area and scale down if needed rather than overflowing.

</details>
