---
id: 2
group: "visual-hierarchy"
dependencies: []
status: "completed"
created: "2026-04-28"
skills:
  - css
---
# Make File Headers Prominent

## Objective
Increase the visual weight of file-to-file boundaries by strengthening the `FileSectionHeader` and adding vertical spacing between file sections, making file transitions unmistakable landmarks while scrolling.

## Skills Required
- CSS (Tailwind utility classes)

## Acceptance Criteria
- [ ] `FileSectionHeader` has a 2px solid top border (`border-t-2 border-border`)
- [ ] `FileSectionHeader` background changed from `bg-muted/50` to `bg-muted/80`
- [ ] Non-first `FileSection` elements have 12px top margin (`[&:not(:first-child)]:mt-3` or equivalent)
- [ ] First file section has no top margin
- [ ] Unit tests pass (`npm run test:unit`)
- [ ] Visual appearance correct in both light and dark themes

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Tailwind CSS utility class modifications only
- No structural/DOM changes
- Must work with the existing sticky header (`sticky top-0 z-10`) without z-index issues

## Input Dependencies
None — this task is independent.

## Output Artifacts
- Modified `packages/react/src/components/DiffViewer/FileSectionHeader.tsx` with updated className
- Modified `packages/react/src/components/DiffViewer/FileSection.tsx` with added margin class

## Implementation Notes

<details>

### Change 1: FileSectionHeader.tsx

**File:** `packages/react/src/components/DiffViewer/FileSectionHeader.tsx`

**Current className on the root element (line ~54):**
```
sticky top-0 z-10 flex items-center gap-2 h-10 px-3 bg-muted/50 backdrop-blur-sm border-b border-border cursor-pointer select-none
```

**Target className:**
```
sticky top-0 z-10 flex items-center gap-2 h-10 px-3 bg-muted/80 backdrop-blur-sm border-t-2 border-b border-border cursor-pointer select-none
```

**Changes:**
1. Change `bg-muted/50` → `bg-muted/80` (more opaque, solid-feeling background)
2. Add `border-t-2` before `border-b` (2px solid top border creates a strong horizontal rule)

Note: `border-border` already applies to all borders, so adding `border-t-2` will use the existing border color.

### Change 2: FileSection.tsx

**File:** `packages/react/src/components/DiffViewer/FileSection.tsx`

**Current className on the root wrapper `<div>` (line ~128):**
```
border-b border-border${dragState ? ' select-none' : ''}
```

**Target className:**
```
border-b border-border [&:not(:first-child)]:mt-3${dragState ? ' select-none' : ''}
```

**Changes:**
1. Add `[&:not(:first-child)]:mt-3` — applies 12px top margin to all file sections except the first one, creating a visible vertical gap between files.

This spacing works because `DiffViewer.tsx` maps files directly as children, so `:first-child` correctly targets the first file section.

**Verification:** Run `npm run test:unit` to ensure no regressions.

</details>
