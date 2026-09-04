---
id: 5
group: "shared-engine-workspace-package"
dependencies: [4]
status: "completed"
created: 2026-09-04
skills:
  - typescript-refactoring
complexity_score: 4
execution_profile: "standard-implementation"
---
# Move fetch-comments as its own commit

## Objective
Relocate the headless `fetch-comments` orchestrator and its test into the engine
package in a single self-contained commit that can be reverted on its own.

## Skills Required
`typescript-refactoring` for the relocation, import repointing and commit
isolation.

## Acceptance Criteria
- [ ] `packages/engine/src/fetch-comments.ts` and `packages/engine/src/fetch-comments.test.ts` exist; neither remains under `src/main/`.
- [ ] `src/main/main.ts` imports `runFetchComments` from `'../../packages/engine/src/fetch-comments'` and its subcommand routing is otherwise unchanged.
- [ ] `git log --oneline -1` shows this move as a single commit touching only these files, and `git revert --no-commit HEAD` followed by `npm run test:unit` leaves the rest of the move intact and green. Undo the revert afterwards.
- [ ] `npm run test:unit` exits 0.
- [ ] The commit message and the eventual pull request body state that this does **not** resolve issue #143.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
`fetch-comments.ts` imports only `fs`, `path`, `packages/core` and
`../shared/types`. Nothing from `src/main/`, nothing from `electron`. Its only
ties to the desktop application are the import at `src/main/main.ts:9` and the
subcommand routing at `src/main/main.ts:602`, and both remain.

This move does not fix issue #143. The desktop binary still imports and routes
the module, so Electron still initialises its platform, and that initialisation
is the crash. Any claim otherwise is wrong.

## Input Dependencies
Task 4 must be complete. All three of tasks 3, 4 and 5 edit `src/main/main.ts`,
so they are sequenced to avoid concurrent edits to the same file, and running
this one last keeps its commit cleanly revertable.

## Output Artifacts
`packages/engine/src/fetch-comments.ts` and its test, in an isolated commit.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. `git mv src/main/fetch-comments.ts packages/engine/src/`
2. `git mv src/main/fetch-comments.test.ts packages/engine/src/`
3. Repoint imports inside the moved file:
   - every `'../../packages/core/src/X'` becomes `'../../core/src/X'`
   - `'../shared/types'` becomes `'../../types/src/index'`
4. Update `src/main/main.ts:9` to import `runFetchComments` from `'../../packages/engine/src/fetch-comments'`. Leave the routing block at line 602 alone.
5. Repoint the same paths in the moved test file.
6. Commit this and nothing else. Verify the isolation:
   `git show --stat HEAD` should list only the four paths above.
7. Prove revertability: `git revert --no-commit HEAD && npm run test:unit` must pass, then `git revert --abort` or `git checkout -- .` to restore.
8. Write the commit message so it states plainly that the change does not resolve issue #143 and explains why: the desktop binary still imports and routes the module, so Electron's platform initialisation — the actual crash — is untouched.
</details>
