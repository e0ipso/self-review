---
id: 1
group: "source-fixes"
dependencies: []
status: "completed"
created: "2026-02-12"
skills:
  - react-components
---

# Fix Source Code Bugs in Diff Viewer and File Tree

## Objective

Fix two source code bugs that cause ~16 e2e test failures: (1) the comment icon is not rendered on context lines in the diff viewer, and (2) the FileTree change-type indicator span lacks a `.change-type-badge` CSS class.

## Skills Required

React component rendering — both fixes are small JSX conditional changes.

## Acceptance Criteria

- [ ] Comment icon buttons appear on context lines (not just additions/deletions) in both split and unified views
- [ ] The change-type indicator span in FileTree has the `change-type-badge` CSS class
- [ ] All existing unit tests continue to pass (`npm run test:unit`)

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- React/TSX component editing
- Understanding of the diff line type system (`context`, `addition`, `deletion`)

## Input Dependencies

None — these are independent source code fixes.

## Output Artifacts

- Modified `src/renderer/components/DiffViewer/SplitView.tsx`
- Modified `src/renderer/components/DiffViewer/UnifiedView.tsx`
- Modified `src/renderer/components/FileTree.tsx`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Fix 1: Comment Icon on Context Lines

**Problem**: The comment icon button is conditionally hidden on context lines via a `line.type !== 'context'` guard. The PRD explicitly states "Comments on added/context lines use `newLineStart`/`newLineEnd`", confirming context-line comments are supported.

**Files and exact locations:**

1. **`src/renderer/components/DiffViewer/SplitView.tsx` line 117**:
   ```tsx
   // BEFORE:
   {lineNumber && line.type !== 'context' && (
   // AFTER:
   {lineNumber && (
   ```

2. **`src/renderer/components/DiffViewer/UnifiedView.tsx` line 119**:
   ```tsx
   // BEFORE:
   {line.oldLineNumber && line.type !== 'context' && (
   // AFTER:
   {line.oldLineNumber && (
   ```

3. **`src/renderer/components/DiffViewer/UnifiedView.tsx` line 145**:
   ```tsx
   // BEFORE:
   {line.newLineNumber && line.type !== 'context' && (
   // AFTER:
   {line.newLineNumber && (
   ```

The icon uses `opacity-0 group-hover/gutter:opacity-100` so it only appears on hover — no visual clutter is introduced. The drag-to-select logic in `FileSection.tsx` already includes context lines in `hunkLineMap`.

### Fix 2: Change-Type Badge CSS Class

**Problem**: The FileTree change-type letter (A/M/D/R) renders in a `<span>` without a `.change-type-badge` class. The e2e test at `01-launch-and-display.steps.ts:152` asserts `entry.locator('.change-type-badge').toHaveText(label)`.

**File**: `src/renderer/components/FileTree.tsx` around line 167

```tsx
// BEFORE:
className={`flex-shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] rounded-sm text-[10px] font-bold leading-none ${changeType.className}`}

// AFTER:
className={`change-type-badge flex-shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] rounded-sm text-[10px] font-bold leading-none ${changeType.className}`}
```

### Verification

Run `npm run test:unit` to ensure all 160 unit tests still pass.

</details>
