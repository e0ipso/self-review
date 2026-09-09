---
id: 4
group: "shared-engine-workspace-package"
dependencies: [3]
status: "completed"
created: 2026-09-04
skills:
  - typescript-refactoring
  - vitest
complexity_score: 5
execution_profile: "standard-implementation"
---
# Extract normalizeGitDiffArgs from cli.ts

## Objective
Move the one pure function out of `src/main/cli.ts` into the engine package,
leaving the Electron-shaped argument handling where it is, and split
`cli.test.ts` along the same line.

## Skills Required
`typescript-refactoring` for the extraction; `vitest` for splitting the test
file so both halves keep running.

## Acceptance Criteria
- [ ] `normalizeGitDiffArgs` lives in `packages/engine/src/git-diff-args.ts` with its body and signature `(args: string[], cwd: string = process.cwd())` unchanged.
- [ ] `src/main/cli.ts` retains `getAppArgs`, `parseCliArgs`, `checkEarlyExit`, `printHelp` and `printVersion`, and imports `normalizeGitDiffArgs` from the engine package.
- [ ] `src/main/main.ts` still calls `normalizeGitDiffArgs` at the same point in startup and behaves identically.
- [ ] The `normalizeGitDiffArgs` describe block has moved from `src/main/cli.test.ts` to `packages/engine/src/git-diff-args.test.ts`; both files exist and both run.
- [ ] `npm run test:unit` exits 0, with the same total number of test cases as before the split.
- [ ] `grep -rn "defaultApp\|psn_" packages/engine/` returns no match.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Only `normalizeGitDiffArgs` moves. `parseCliArgs` and `checkEarlyExit` both route
through `getAppArgs`, which reads `process.defaultApp` for Electron's dev-mode
argv shape and strips macOS Finder `-psn_` arguments. Moving them would require
changing their signatures to accept an argv array, which is a rewrite rather than
a move, and the plan explicitly rules it out.

## Input Dependencies
Task 3 must be complete — it establishes the package layout and the deep
relative import convention this task follows.

## Output Artifacts
`packages/engine/src/git-diff-args.ts` and its test; a slimmer `src/main/cli.ts`.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Create `packages/engine/src/git-diff-args.ts`. Move `normalizeGitDiffArgs` into it verbatim, together with its doc comment. It needs `existsSync` from `fs` and `resolve` from `path`; add those imports.
2. Delete the function from `src/main/cli.ts`. Remove `existsSync` and `resolve` from that file's imports ONLY if nothing else there uses them — check first.
3. `src/main/cli.ts` currently exports `normalizeGitDiffArgs` and `src/main/main.ts` imports it from `'./cli'`. Two options; take the second:
   - re-export it from `cli.ts`, or
   - change `src/main/main.ts` to import it directly from `'../../packages/engine/src/git-diff-args'`.
   The plan states no re-export shims are retained for moved code, so import it directly and drop it from the `'./cli'` import list at `src/main/main.ts:8`.
4. Split the test: move the `describe('normalizeGitDiffArgs', ...)` block (around lines 302-334 of `src/main/cli.test.ts`) into a new `packages/engine/src/git-diff-args.test.ts`, with an import of the function from `./git-diff-args`. Leave the `parseCliArgs` and `checkEarlyExit` blocks in `src/main/cli.test.ts`.
5. Confirm the case count is conserved: run `npm run test:unit` and check that the sum of test cases across the main config and the engine workspace matches what the main config alone reported before this task.

Do not move `printHelp` or `printVersion`. They print text describing the desktop
binary and belong to it.
</details>
