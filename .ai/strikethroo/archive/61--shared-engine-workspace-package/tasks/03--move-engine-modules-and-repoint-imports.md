---
id: 3
group: "shared-engine-workspace-package"
dependencies: [2]
status: "completed"
created: 2026-09-04
skills:
  - typescript-refactoring
  - vitest
complexity_score: 7
complexity_notes: "Wide blast radius: six modules plus five test files relocate, five import edges repoint, two shims are deleted and every consuming site in src/main updates. Mechanical throughout, but nothing compiles until the whole set is consistent, so it cannot be meaningfully split without leaving the tree broken."
execution_profile: "complex-architecture"
---
# Move the engine modules and repoint their imports

## Objective
Relocate the six whole Node-only modules and their tests into
`packages/engine/src/`, repoint every import that would otherwise cross back
into `src/`, and delete the two re-export shims the move strands.

## Skills Required
`typescript-refactoring` for the relocation and import rewriting;
`vitest` for keeping the relocated test files running.

## Acceptance Criteria
- [ ] These six files live in `packages/engine/src/`: `review-handlers.ts`, `remote-mode.ts`, `guide-loader.ts`, `startup-mode.ts`, `git-diff-loader.ts`, `staged-untracked.ts`, and no longer exist under `src/main/`.
- [ ] These five test files moved with them: `review-handlers.test.ts`, `remote-mode.test.ts`, `guide-loader.test.ts`, `startup-mode.test.ts`, `staged-untracked.test.ts`.
- [ ] `grep -rnE "from '\\.\\./(shared|main)/" packages/engine/src/` returns no match — nothing in the package resolves into `src/`.
- [ ] `src/main/diff-parser.ts` and `src/main/git.ts` are deleted, and `grep -rn "from './diff-parser'\|from './git'" src/` returns no match.
- [ ] `npm run test:unit` exits 0 and the engine workspace reports 5 test files.
- [ ] `npm start` launches the desktop application against a real repository and a diff renders.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Relocated files change only in their import lines. No reformatting, no renaming,
no logic edits. An improvement noticed in passing is noted for later, not folded
in — the reviewability of this change is the whole point of the plan.

## Input Dependencies
Task 2 must have created `packages/engine` and wired the root `test:unit`
script, otherwise the relocated tests silently stop running.

## Output Artifacts
Six modules and five test files under `packages/engine/src/`; a `src/main/`
holding two fewer shims; updated import sites in `src/main/main.ts` and
`src/main/ipc-handlers.ts`.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

Move with `git mv` so rename detection works in review:

```
git mv src/main/review-handlers.ts      packages/engine/src/
git mv src/main/remote-mode.ts          packages/engine/src/
git mv src/main/guide-loader.ts         packages/engine/src/
git mv src/main/startup-mode.ts         packages/engine/src/
git mv src/main/git-diff-loader.ts      packages/engine/src/
git mv src/main/staged-untracked.ts     packages/engine/src/
git mv src/main/review-handlers.test.ts packages/engine/src/
git mv src/main/remote-mode.test.ts     packages/engine/src/
git mv src/main/guide-loader.test.ts    packages/engine/src/
git mv src/main/startup-mode.test.ts    packages/engine/src/
git mv src/main/staged-untracked.test.ts packages/engine/src/
```

`git-diff-loader.ts` has no test file; that is correct, not an omission.

Then repoint imports INSIDE the moved files:

| File | From | To |
| --- | --- | --- |
| `git-diff-loader.ts` | `'./git'` | `'../../core/src/git'` |
| `git-diff-loader.ts` | `'./diff-parser'` | `'../../core/src/diff-parser'` |
| `review-handlers.ts` | `'./directory-scanner'` | `'../../core/src/directory-scanner'` |
| `review-handlers.ts` | `'./payload-sizing'` | `'../../core/src/payload-sizing'` |
| `review-handlers.test.ts` | `'./git'` | `'../../core/src/git'` |
| `git-diff-loader.ts`, `guide-loader.ts`, `remote-mode.ts`, `review-handlers.ts` | `'../shared/types'` | `'../../types/src/index'` |
| moved files reaching core | `'../../packages/core/src/X'` | `'../../core/src/X'` |

The last row matters: files that were two levels below the repo root are now two
levels below it in a different place, so their existing deep paths into
`packages/core` need one segment removed.

`remote-mode.ts` imports `'./git-diff-loader'`; both moved, so that import is
already correct and must be left alone.

Then update the consumers that stayed behind:

- `src/main/main.ts` imports `git-diff-loader`, `guide-loader`, `remote-mode`, `staged-untracked` and `startup-mode` from `'./X'`. Repoint each to `'../../packages/engine/src/X'`.
- `src/main/ipc-handlers.ts` imports `review-handlers` from `'./review-handlers'`. Repoint to `'../../packages/engine/src/review-handlers'`.

Then delete the stranded shims:

```
git rm src/main/diff-parser.ts src/main/git.ts
```

Both had exactly two consumers — `git-diff-loader.ts` and
`review-handlers.test.ts` — and both moved, so nothing imports them any more.
Do NOT delete `synthetic-diff.ts`: it is already unreferenced on the default
branch, predates this change, and is out of scope.

Verify before finishing: `npm run test:unit` green with the engine workspace
reporting 5 files, and `npm start` opening a real diff.
</details>
