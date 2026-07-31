---
id: 4
group: "main-process"
dependencies: []
status: "completed"
created: "2026-02-18"
skills:
  - typescript
---

# Extract git-diff-loader.ts from main.ts and ipc-handlers.ts

## Objective

Create `src/main/git-diff-loader.ts` containing a single `loadGitDiffWithUntracked` function that encapsulates the duplicated git-diff + untracked-files loading pattern. Update `main.ts` and `ipc-handlers.ts` to call this function instead of inlining the logic.

## Skills Required

- TypeScript: Extracting async logic into a shared module in the Electron main process

## Acceptance Criteria

- [ ] `src/main/git-diff-loader.ts` exists with `loadGitDiffWithUntracked` exported
- [ ] Function signature: `(gitDiffArgs: string[]) => Promise<{ files: DiffFile[]; repository: string }>`
- [ ] `main.ts` calls `loadGitDiffWithUntracked(gitDiffArgs)` instead of inlining the logic (lines ~205-238)
- [ ] `ipc-handlers.ts` calls `loadGitDiffWithUntracked([])` instead of inlining the logic (lines ~236-254)
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run test:unit` passes with no regressions

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- The function must import from `./git` (`runGitDiffAsync`, `getRepoRootAsync`, `getUntrackedFilesAsync`, `generateUntrackedDiffs`) and from `./diff-parser` (`parseDiff`)
- Import `DiffFile` from `../shared/types`
- `main.ts` currently uses static imports for git functions; the new module should also use static imports
- `ipc-handlers.ts` currently uses dynamic `await import('./git')` — after the extraction, it can simply import `loadGitDiffWithUntracked` statically from `./git-diff-loader`
- Logging (`console.error`) currently present in `main.ts` should NOT be moved into the shared function — it's debug verbosity specific to startup. The extracted function should be clean with no logging.

## Input Dependencies

None — main process files are independent of renderer tasks.

## Output Artifacts

- New file: `src/main/git-diff-loader.ts`
- Modified: `src/main/main.ts`
- Modified: `src/main/ipc-handlers.ts`

## Implementation Notes

<details>

### Step 1: Create `src/main/git-diff-loader.ts`

```typescript
import type { DiffFile } from '../shared/types';
import { runGitDiffAsync, getRepoRootAsync, getUntrackedFilesAsync, generateUntrackedDiffs } from './git';
import { parseDiff } from './diff-parser';

export async function loadGitDiffWithUntracked(
  gitDiffArgs: string[]
): Promise<{ files: DiffFile[]; repository: string }> {
  const repository = await getRepoRootAsync();
  const rawDiff = await runGitDiffAsync(gitDiffArgs);
  const files = parseDiff(rawDiff);

  const untrackedPaths = await getUntrackedFilesAsync();
  let allFiles = files;
  if (untrackedPaths.length > 0) {
    const untrackedDiffStr = generateUntrackedDiffs(untrackedPaths, repository);
    if (untrackedDiffStr.length > 0) {
      const untrackedFiles = parseDiff(untrackedDiffStr);
      for (const file of untrackedFiles) {
        file.isUntracked = true;
      }
      allFiles = [...files, ...untrackedFiles];
    }
  }

  return { files: allFiles, repository };
}
```

### Step 2: Update `main.ts`

1. Add import: `import { loadGitDiffWithUntracked } from './git-diff-loader';`
2. In the `if (mode === 'git')` block (around lines 200-238), replace the inline logic with:
   ```typescript
   console.error('[main] Git diff args:', gitDiffArgs.join(' '));
   const { files: allFiles, repository } = await loadGitDiffWithUntracked(gitDiffArgs);
   console.error('[main] Loaded', allFiles.length, 'files from repository:', repository);
   ```
3. Keep the `diffData = { ... }` assignment that follows, using `allFiles` and `repository` from the destructured result
4. Remove any imports from `./git` and `./diff-parser` that are no longer needed directly in `main.ts`. **Be careful**: `main.ts` may use other functions from `./git` (like `getRepoRootAsync` for other purposes) or `parseDiff` for other code paths. Only remove imports that are truly unused after the refactoring.

### Step 3: Update `ipc-handlers.ts`

1. Add import at the top of the file: `import { loadGitDiffWithUntracked } from './git-diff-loader';`
2. In the `if (isGitRepo)` block (around lines 231-254), replace:
   ```typescript
   const { runGitDiffAsync, getRepoRootAsync, getUntrackedFilesAsync, generateUntrackedDiffs } = await import('./git');
   const { parseDiff } = await import('./diff-parser');
   // ... all the inline logic ...
   ```
   With:
   ```typescript
   const { files: allFiles, repository } = await loadGitDiffWithUntracked([]);
   ```
3. Update the `payload` assignment to use `allFiles` and `repository` from the destructured result
4. Remove the dynamic `await import('./git')` and `await import('./diff-parser')` calls that are no longer needed

### Verification

Run `npx tsc --noEmit` and `npm run test:unit`.

</details>
