---
id: 9
group: "filetree-refactor"
dependencies: []
status: "completed"
created: "2026-03-11"
skills: ["react-components", "typescript"]
---
# Extract `FileTreeEntry` from `FileTree`

## Objective
Extract the ~70-line per-file row JSX from `FileTree.tsx`'s `map()` callback into a `FileTreeEntry` component, making the list iteration trivial and giving the row its own clear prop surface.

## Skills Required
- react-components
- typescript

## Acceptance Criteria
- [ ] `FileTreeEntry.tsx` exists in `packages/react/src/components/`
- [ ] Component renders: change-type badge, truncated path, stats, comment count, and the viewed toggle
- [ ] `FileTree.tsx` `map()` callback is reduced to a single `<FileTreeEntry ... />` call
- [ ] `FileTree.tsx` is materially reduced in size
- [ ] `npm run test:unit` passes

## Technical Requirements
- Source file: `packages/react/src/components/FileTree.tsx`
- New file: `packages/react/src/components/FileTreeEntry.tsx`
- Props: `file`, `isActive`, `commentCount`, `viewed`, `onScrollToFile`, `onToggleViewed`
- `FileTreeEntry` may call `useConfig` directly if it needs display config rather than receiving all config values as props

## Input Dependencies
None

## Output Artifacts
- `packages/react/src/components/FileTreeEntry.tsx`
- Updated `packages/react/src/components/FileTree.tsx`

## Implementation Notes

<details>
<summary>Step-by-step implementation</summary>

1. **Read `FileTree.tsx`** and locate the `filteredFiles.map(...)` callback. It renders each file row inline with change-type badges, truncated path display, diff stat numbers, comment count badge, and the viewed toggle checkbox.

2. **Create `FileTreeEntry.tsx`** in `packages/react/src/components/`:
   ```tsx
   interface FileTreeEntryProps {
     file: DiffFile;
     isActive: boolean;
     commentCount: number;
     viewed: boolean;
     onScrollToFile: (filePath: string) => void;
     onToggleViewed: (filePath: string) => void;
   }
   export function FileTreeEntry({ file, isActive, commentCount, viewed, onScrollToFile, onToggleViewed }: FileTreeEntryProps) { ... }
   ```
   Move the full row JSX into this component.

3. **Update `FileTree.tsx`**: replace the multi-line `map()` callback with:
   ```tsx
   filteredFiles.map((file) => (
     <FileTreeEntry
       key={file.filePath}
       file={file}
       isActive={activeFile === file.filePath}
       commentCount={commentCounts[file.filePath] ?? 0}
       viewed={viewedFiles.has(file.filePath)}
       onScrollToFile={scrollToFile}
       onToggleViewed={toggleViewed}
     />
   ))
   ```

4. **Run `npm run test:unit`** and confirm no failures.

5. **Size check**: `FileTree.tsx` should be ~80 lines or fewer.

</details>
