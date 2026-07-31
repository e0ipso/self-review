---
id: 1
group: "renderer-utilities"
dependencies: []
status: "completed"
created: "2026-02-18"
skills:
  - typescript
  - react-components
complexity_score: 4
complexity_notes: "Touches 5 files (1 new + 4 consumers) but all changes are mechanical: extract functions, update imports, delete originals"
---

# Create diff-styles.ts utility and update consumers

## Objective

Create a new shared utility module `src/renderer/utils/diff-styles.ts` containing four functions (`getLineBg`, `getGutterBg`, `getFileStats`, `getChangeTypeInfo`) extracted from SplitView.tsx, UnifiedView.tsx, FileTree.tsx, and FileSection.tsx. Update all four consumer files to import from the new module and remove the duplicated inline functions.

## Skills Required

- TypeScript: Pure function extraction with correct type signatures
- React components: Updating imports and removing inline functions from components

## Acceptance Criteria

- [ ] `src/renderer/utils/diff-styles.ts` exists with all four exported functions
- [ ] `getLineBg` accepts `DiffLine | null` and returns a Tailwind class string
- [ ] `getGutterBg` accepts `DiffLine | null` and returns a Tailwind class string
- [ ] `getFileStats` accepts `DiffFile` and returns `{ additions: number; deletions: number }`
- [ ] `getChangeTypeInfo` accepts `DiffFile['changeType']` and returns `{ label: string; className: string }` with a default fallback
- [ ] SplitView.tsx imports `getLineBg` and `getGutterBg` from diff-styles, inline functions removed
- [ ] UnifiedView.tsx imports `getLineBg` and `getGutterBg` from diff-styles, inline functions removed
- [ ] FileTree.tsx imports `getFileStats` and `getChangeTypeInfo` (renamed from `getChangeType`), inline functions removed
- [ ] FileSection.tsx imports `getFileStats` (renamed from `getLineStats`) and `getChangeTypeInfo` (renamed from `getChangeTypeStyle`), inline functions removed
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run test:unit` passes with no regressions

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Import `DiffFile` and `DiffLine` from `../../../shared/types` (adjust relative path for `src/renderer/utils/`)
- `getLineBg` must handle `null` (return `''`) — SplitView passes `DiffLine | null`, UnifiedView passes `DiffLine` (subtype-compatible)
- `getGutterBg` must handle `null` (return `'bg-muted/30'`) — same reasoning
- `getChangeTypeInfo` must include a default fallback returning `{ label: '?', className: '' }` (FileSection had `default: return ''`, FileTree had no default)
- The `src/renderer/utils/` directory does not currently exist — create it

## Input Dependencies

None — this is a standalone extraction.

## Output Artifacts

- New file: `src/renderer/utils/diff-styles.ts`
- Modified: `src/renderer/components/DiffViewer/SplitView.tsx`
- Modified: `src/renderer/components/DiffViewer/UnifiedView.tsx`
- Modified: `src/renderer/components/FileTree.tsx`
- Modified: `src/renderer/components/DiffViewer/FileSection.tsx`

## Implementation Notes

<details>

### Step 1: Create the utility file

Create `src/renderer/utils/diff-styles.ts`:

```typescript
import type { DiffFile, DiffLine } from '../../shared/types';

export function getLineBg(line: DiffLine | null): string {
  if (!line) return '';
  if (line.type === 'addition') return 'bg-emerald-50/70 dark:bg-emerald-900/40';
  if (line.type === 'deletion') return 'bg-red-50/70 dark:bg-red-900/40';
  return '';
}

export function getGutterBg(line: DiffLine | null): string {
  if (!line) return 'bg-muted/30';
  if (line.type === 'addition') return 'bg-emerald-100/80 dark:bg-emerald-900/50';
  if (line.type === 'deletion') return 'bg-red-100/80 dark:bg-red-900/50';
  return 'bg-muted/30';
}

export function getFileStats(file: DiffFile): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'addition') additions++;
      if (line.type === 'deletion') deletions++;
    }
  }
  return { additions, deletions };
}

export function getChangeTypeInfo(
  changeType: DiffFile['changeType']
): { label: string; className: string } {
  switch (changeType) {
    case 'added':
      return { label: 'A', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' };
    case 'modified':
      return { label: 'M', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' };
    case 'deleted':
      return { label: 'D', className: 'bg-red-500/15 text-red-700 dark:text-red-400' };
    case 'renamed':
      return { label: 'R', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' };
    default:
      return { label: '?', className: '' };
  }
}
```

### Step 2: Update SplitView.tsx

1. Add import at top: `import { getLineBg, getGutterBg } from '../../utils/diff-styles';`
2. Delete the inline `getLineBg` function (lines 107-113) and the inline `getGutterBg` function (lines 115-121) from inside the component
3. All existing call sites already pass `DiffLine | null`, so no call-site changes needed

### Step 3: Update UnifiedView.tsx

1. Add import at top: `import { getLineBg, getGutterBg } from '../../utils/diff-styles';`
2. Delete the inline `getLineBg` function (lines 46-51) and inline `getGutterBg` function (lines 53-58)
3. Call sites pass `DiffLine` (non-nullable), which is compatible with `DiffLine | null` parameter

### Step 4: Update FileTree.tsx

1. Add import at top: `import { getFileStats, getChangeTypeInfo } from '../utils/diff-styles';`
2. Delete the inline `getFileStats` function (lines 33-43) and the inline `getChangeType` function (lines 55-78)
3. Update all call sites: rename `getChangeType(...)` → `getChangeTypeInfo(...)`. The return type `{ label, className }` is identical, so destructuring sites need no changes.

### Step 5: Update FileSection.tsx

1. Add import at top: `import { getFileStats, getChangeTypeInfo } from '../../utils/diff-styles';`
2. Delete the inline `getChangeTypeStyle` function (lines 568-581) and inline `getLineStats` function (lines 583-593)
3. Update call sites:
   - Where `getLineStats()` was called (line 595: `const { additions, deletions } = getLineStats();`), change to `const { additions, deletions } = getFileStats(file);` — note the function now takes `file` as a parameter instead of closing over it
   - Where `getChangeTypeStyle()` was called, change to `getChangeTypeInfo(file.changeType).className` — the old function returned only a className string, but the new function returns `{ label, className }`, so destructure or access `.className`

### Verification

Run `npx tsc --noEmit` to confirm type safety, then `npm run test:unit` to check for regressions.

</details>
