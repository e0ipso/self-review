---
id: 3
group: "core-infrastructure"
dependencies: [2]
status: "completed"
created: "2026-02-16"
skills:
  - typescript
  - nodejs
---

# Create Directory Scanner Module

## Objective

Create `src/main/directory-scanner.ts` that recursively enumerates all files in a directory and produces `DiffFile[]` by passing them through the extracted synthetic diff generator and existing diff parser.

## Skills Required

- TypeScript, Node.js filesystem APIs

## Acceptance Criteria

- [ ] `src/main/directory-scanner.ts` exists with a single exported async function
- [ ] The function recursively walks a directory and collects all file paths
- [ ] File paths are passed to `generateSyntheticDiffs()` from `synthetic-diff.ts`
- [ ] The resulting unified diff text is parsed through `parseDiff()` from `diff-parser.ts`
- [ ] All files get `changeType: 'added'`
- [ ] Binary files are handled the same way as in git mode (listed with indicator, no diff content)
- [ ] Unit tests cover: directory with mixed files, empty directory, binary files
- [ ] TypeScript compiles with zero errors

## Technical Requirements

- Use Node.js `fs/promises` with `recursive` option for `readdir`
- File paths must be relative to the directory root (matching how git paths work)
- Reuse `generateSyntheticDiffs()` from `src/main/synthetic-diff.ts`
- Reuse `parseDiff()` from `src/main/diff-parser.ts`
- Handle errors gracefully (unreadable files, permission errors) — skip with stderr warning

## Input Dependencies

- Task 2: `synthetic-diff.ts` must exist with the exported generation function

## Output Artifacts

- New file `src/main/directory-scanner.ts`
- New file `src/main/directory-scanner.test.ts` with unit tests

## Implementation Notes

<details>

1. **Create `src/main/directory-scanner.ts`** with a function like:
   ```typescript
   import { generateSyntheticDiffs } from './synthetic-diff';
   import { parseDiff } from './diff-parser';
   import type { DiffFile } from '../shared/types';
   import { readdir } from 'fs/promises';
   import { join, relative } from 'path';

   export async function scanDirectory(directoryPath: string): Promise<DiffFile[]> {
     // 1. Recursively list all files
     const entries = await readdir(directoryPath, { recursive: true, withFileTypes: true });
     const filePaths = entries
       .filter(e => e.isFile())
       .map(e => relative(directoryPath, join(e.parentPath ?? e.path, e.name)));

     // 2. Generate synthetic diffs
     const diffText = await generateSyntheticDiffs(filePaths, directoryPath);

     // 3. Parse through existing parser
     return parseDiff(diffText);
   }
   ```

2. **Adapt the exact function signatures** based on what was extracted in Task 2. The above is a template — match the actual API of `generateSyntheticDiffs`.

3. **Error handling**: Wrap individual file reads in try/catch. If a file can't be read (permissions), log to stderr and skip it. Do not fail the entire scan.

4. **Unit tests** (`directory-scanner.test.ts`):
   - Create temp directories with `fs.mkdtemp` in test setup
   - Test with a mix of text files, a binary file, and an empty directory
   - Verify all files come back as `changeType: 'added'`
   - Verify file paths are relative
   - Clean up temp directories in teardown

5. **Do NOT filter by file extension** — include all files. The synthetic diff generator already handles binary detection.

</details>
