---
id: 6
group: "deduplication"
dependencies: [1, 3, 4, 5]
status: "pending"
created: "2026-03-11"
skills:
  - "typescript"
  - "react-components"
---
# Remove Renderer Duplicate Files

## Objective
Delete all renderer files classified in the overlap matrix and update all import references in the remaining renderer shell code to point to `packages/react/src`. Follow the deletion order: `identical` → `import-only` → `behavioral` (only after parity is confirmed by previous tasks).

## Skills Required
- TypeScript (import path updates)
- react-components (React import updates)

## Acceptance Criteria
- [ ] All `identical` files from the overlap matrix are deleted from `src/renderer/`
- [ ] All `import-only` files from the overlap matrix are deleted from `src/renderer/` after import normalization
- [ ] All `behavioral` files from the overlap matrix are deleted from `src/renderer/` (parity completed by tasks 3–5)
- [ ] All surviving renderer files import from `packages/react/src/` (or `@self-review/core`) instead of deleted local files
- [ ] `src/renderer/` retains only Electron-shell files: app composition, dialogs/banners/find-bar/welcome, and bridge code
- [ ] `tsc --noEmit` passes with no import errors
- [ ] `npm run test:unit` passes

## Technical Requirements
- Use the `## Overlap Matrix` from the plan (Task 01 output) as the deletion authority
- After deleting each class, run `tsc --noEmit` to catch broken imports before proceeding
- Update import paths: `../../components/Foo` → relative path into `packages/react/src/components/Foo` (or use package alias if configured)
- Entry references must use current paths (`src/renderer.ts`, not `src/renderer/index.tsx`) — verify no obsolete entry points remain

## Input Dependencies
- Task 01: overlap matrix (deletion scope)
- Task 03: host-driven save implemented (behavioral save-related files can be deleted)
- Task 04: config injection implemented (behavioral config-related files can be deleted)
- Task 05: FileSection preview parity implemented (behavioral FileSection can be deleted)

## Output Artifacts
- Deleted renderer duplicate files (tracked by git)
- Updated import statements in surviving renderer files
- Clean `tsc --noEmit` output

## Implementation Notes

<details>
<summary>Deletion process</summary>

**Step 1: Delete `identical` files**
1. Read the `## Overlap Matrix` from the plan document
2. For each `identical` entry: delete the renderer file, update all `import` statements that referenced it to point to the package path
3. Run `tsc --noEmit` after each deletion batch — fix any broken imports before continuing

**Step 2: Delete `import-only` files**
1. For each `import-only` entry: update the imports inside the file first (change `../../shared/types` to `@self-review/core`), then verify the file is now functionally identical to the package version, then delete and update references

**Step 3: Delete `behavioral` files**
1. For each `behavioral` entry: confirm the behavioral divergence was resolved in tasks 3/4/5, then delete and update references

**Finding usages before deletion:**
```bash
# Find all files that import a specific renderer file before deleting
rg "from.*ComponentName" src/renderer/
```

**After all deletions:**
- Run `rg "window\\.electronAPI" packages/react/src` → must return empty
- Run `rg "review:request|onRequestReview" src/renderer packages/react/src` → must return empty
- Run `tsc --noEmit` → must pass
- Run `npm run test:unit` → must pass
</details>
