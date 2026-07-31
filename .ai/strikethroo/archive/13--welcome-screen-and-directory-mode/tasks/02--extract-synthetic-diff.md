---
id: 2
group: "core-infrastructure"
dependencies: []
status: "completed"
created: "2026-02-16"
skills:
  - typescript
---

# Extract Synthetic Diff Generation into Reusable Module

## Objective

Move the `generateUntrackedDiffs()` function and its binary detection logic from `src/main/git.ts` into a new `src/main/synthetic-diff.ts` module. The function has zero git dependency and will be reused by both git untracked file handling and the new directory scanner.

## Skills Required

- TypeScript module extraction and refactoring

## Acceptance Criteria

- [ ] `src/main/synthetic-diff.ts` exists with the extracted function(s)
- [ ] `src/main/git.ts` imports from `synthetic-diff.ts` instead of containing the logic inline
- [ ] The function signature and behavior are identical to the original
- [ ] All existing unit tests for git.ts pass unchanged
- [ ] TypeScript compiles with zero errors

## Technical Requirements

- The extracted function should have a clear, generic name like `generateSyntheticDiffs(filePaths: string[], basePath: string): string` (returning unified diff text)
- Binary file detection logic must move with it
- `git.ts` must import and call the extracted function for its untracked files path

## Input Dependencies

None — this is an independent refactor of existing code.

## Output Artifacts

- New file `src/main/synthetic-diff.ts` with exported synthetic diff generation function
- Updated `src/main/git.ts` importing from the new module

## Implementation Notes

<details>

1. **Read `src/main/git.ts`** to find the `generateUntrackedDiffs()` function and any helper functions it uses (binary detection, file reading, diff text formatting).

2. **Identify all code to extract**: Look for:
   - The main function that takes file paths and generates unified diff text
   - Binary file detection (likely checks file content for null bytes or uses file extension)
   - Any utility functions used only by the synthetic diff generation

3. **Create `src/main/synthetic-diff.ts`**:
   - Move the identified functions into this new file
   - Export the main function with a clear name (e.g., `generateSyntheticDiffs`)
   - Keep the same parameter types and return type

4. **Update `src/main/git.ts`**:
   - Import the extracted function: `import { generateSyntheticDiffs } from './synthetic-diff';`
   - Replace the inline implementation with a call to the imported function
   - If `git.ts` re-exports the function, that's fine for backward compatibility

5. **Run tests**: `npm run test:unit:main` to verify git.ts tests still pass. If there are tests specifically for `generateUntrackedDiffs`, they may need import path updates.

6. **Do NOT change any function behavior** — this is a pure extraction refactor.

</details>
