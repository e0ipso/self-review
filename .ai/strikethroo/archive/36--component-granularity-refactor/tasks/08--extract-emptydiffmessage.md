---
id: 8
group: "diffviewer-refactor"
dependencies: []
status: "completed"
created: "2026-03-11"
skills: ["react-components", "typescript"]
---
# Extract `EmptyDiffMessage` from `DiffViewer`

## Objective
Extract the four empty-state branches (~120 lines of JSX) from `DiffViewer.tsx` into a standalone `EmptyDiffMessage` component, reducing the orchestrator to list-rendering concerns only.

## Skills Required
- react-components
- typescript

## Acceptance Criteria
- [ ] `EmptyDiffMessage.tsx` exists in `packages/react/src/components/DiffViewer/`
- [ ] Component accepts `diffSource` as its primary prop and renders the appropriate message (welcome/loading pass-through, file-mode error, directory-mode message, git-mode detailed help table)
- [ ] `DiffViewer.tsx` calls `<EmptyDiffMessage diffSource={...} />` when `diffFiles.length === 0`, replacing the four inline branches
- [ ] `DiffViewer.tsx` is reduced in size with the empty-state JSX fully removed
- [ ] `npm run test:unit` passes

## Technical Requirements
- Source file: `packages/react/src/components/DiffViewer/DiffViewer.tsx`
- New file: `packages/react/src/components/DiffViewer/EmptyDiffMessage.tsx`
- The git-mode usage examples table stays within `EmptyDiffMessage` since it is part of the same messaging concern

## Input Dependencies
None

## Output Artifacts
- `packages/react/src/components/DiffViewer/EmptyDiffMessage.tsx`
- Updated `packages/react/src/components/DiffViewer/DiffViewer.tsx`

## Implementation Notes

<details>
<summary>Step-by-step implementation</summary>

1. **Read `DiffViewer.tsx`** and locate the empty-state rendering block — the conditional that fires when `diffFiles.length === 0`. It should contain four branches based on `diffSource` type (welcome loading, file-mode error, directory-mode, git-mode with usage table).

2. **Create `EmptyDiffMessage.tsx`**:
   ```tsx
   interface EmptyDiffMessageProps {
     diffSource: DiffSource; // use the shared type from types.ts
   }
   export function EmptyDiffMessage({ diffSource }: EmptyDiffMessageProps) { ... }
   ```
   Move all four branch JSX blocks into this component. Keep the git-mode usage examples table inside this component.

3. **Update `DiffViewer.tsx`**: replace the entire multi-branch empty-state block with:
   ```tsx
   if (diffFiles.length === 0) return <EmptyDiffMessage diffSource={diffSource} />;
   ```
   (or equivalent inline usage)

4. **Run `npm run test:unit`** and confirm no failures.

5. **Size check**: `DiffViewer.tsx` should be noticeably reduced (~120 lines removed).

</details>
