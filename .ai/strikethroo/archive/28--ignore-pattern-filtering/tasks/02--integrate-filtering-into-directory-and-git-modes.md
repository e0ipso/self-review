---
id: 2
group: "core-implementation"
dependencies: [1]
status: "completed"
created: "2026-03-03"
skills:
  - typescript
  - electron
---
# Integrate ignore filtering into directory and git modes

## Objective
Apply the ignore filter from task 1 to both directory scanning and git diff loading, so files matching ignore patterns are excluded from the review UI.

## Skills Required
- typescript, electron

## Acceptance Criteria
- [ ] `scanDirectory()` accepts an optional `ignorePatterns: string[]` parameter
- [ ] In directory mode, `scanDirectory` filters out files matching ignore patterns before generating synthetic diffs
- [ ] In git mode, `DiffFile[]` is filtered after parsing to exclude files matching ignore patterns
- [ ] `main.ts` passes `appConfig.ignore` to both code paths
- [ ] The welcome screen's directory picker also applies ignore filtering
- [ ] Unit test for `scanDirectory` with ignore patterns

## Technical Requirements
- Import `createIgnoreFilter` from `./ignore-filter`
- In `directory-scanner.ts`: filter `filePaths` array before passing to `generateSyntheticDiffs`
- In `main.ts`: filter `diffData.files` after loading in git mode using `file.newPath || file.oldPath`
- In `ipc-handlers.ts`: pass ignore patterns when welcome screen triggers directory scan

## Input Dependencies
- Task 1: `createIgnoreFilter` utility and `ignore` package

## Output Artifacts
- Modified `src/main/directory-scanner.ts`
- Modified `src/main/main.ts`
- Modified `src/main/ipc-handlers.ts`
- Updated `src/main/directory-scanner.test.ts`

## Implementation Notes

<details>

### directory-scanner.ts changes

Update `scanDirectory` signature:
```typescript
export async function scanDirectory(
  directoryPath: string,
  ignorePatterns: string[] = []
): Promise<DiffFile[]> {
```

After collecting `filePaths` and sorting, before the `generateSyntheticDiffs` call:
```typescript
const shouldKeep = createIgnoreFilter(ignorePatterns);
const filteredPaths = filePaths.filter(shouldKeep);
```

Then use `filteredPaths` instead of `filePaths` for the rest.

### main.ts changes

In directory mode (around line 240):
```typescript
const files = await scanDirectory(directoryPath, appConfig.ignore);
```

In git mode (around line 215), after `loadGitDiffWithUntracked`:
```typescript
const shouldKeep = createIgnoreFilter(appConfig.ignore);
const filteredFiles = allFiles.filter(f => shouldKeep(f.newPath || f.oldPath));
```

### ipc-handlers.ts changes

Find where `scanDirectory` is called from the welcome screen's browse flow (around line 267) and pass the config's ignore patterns. The config is already available via `getConfigData()`.

### directory-scanner.test.ts

Add a test that creates a temp directory with `node_modules/dep/index.js` and `src/app.ts`, calls `scanDirectory(dir, ['node_modules'])`, and verifies only `src/app.ts` is returned.

</details>
