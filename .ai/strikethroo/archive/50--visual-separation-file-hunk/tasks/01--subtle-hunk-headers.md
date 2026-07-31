---
id: 1
group: "visual-hierarchy"
dependencies: []
status: "completed"
created: "2026-04-28"
skills:
  - css
---
# Make Hunk Headers Subtle

## Objective
Reduce the visual weight of hunk-to-hunk separators in `HunkHeader.tsx` so they clearly read as "same file, different section" rather than competing with file-level boundaries.

## Skills Required
- CSS (Tailwind utility classes)

## Acceptance Criteria
- [ ] Hunk header background removed (`bg-accent/30` gone)
- [ ] Hunk header uses dashed top border at 40% opacity (`border-t border-dashed border-border/40`)
- [ ] The `@@` text, font, height, and padding remain unchanged
- [ ] Unit tests pass (`npm run test:unit`)
- [ ] Visual appearance correct in both light and dark themes

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Tailwind CSS utility class modifications only
- No structural/DOM changes

## Input Dependencies
None — this task is independent.

## Output Artifacts
- Modified `packages/react/src/components/DiffViewer/HunkHeader.tsx` with updated className

## Implementation Notes

<details>

**File:** `packages/react/src/components/DiffViewer/HunkHeader.tsx`

**Current className on the root `<div>`:**
```
hunk-header flex items-center h-7 px-3 bg-accent/30 text-muted-foreground/70 text-xs font-mono border-t border-border/30
```

**Target className:**
```
hunk-header flex items-center h-7 px-3 text-muted-foreground/70 text-xs font-mono border-t border-dashed border-border/40
```

**Changes:**
1. Remove `bg-accent/30` (eliminates the colored background fill)
2. Remove `border-border/30` and replace with `border-dashed border-border/40` (changes solid 30% border to dashed 40% border)

The result: the hunk header becomes a lightweight dashed line with monospace `@@` text, no longer a colored bar that competes with file headers.

**Verification:** Run `npm run test:unit` to ensure no regressions.

</details>
