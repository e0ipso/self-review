---
id: 6
group: "shared-engine-workspace-package"
dependencies: [5]
status: "completed"
created: 2026-09-04
skills:
  - playwright
  - bash
complexity_score: 6
complexity_notes: "Spans the whole change: mechanical source invariants, a clean-install rebuild, the packaged integration comparison, and three desktop launch paths that no automated suite covers."
execution_profile: "complex-architecture"
---
# Verify the package boundary and run the full validation

## Objective
Prove the separation mechanically rather than by assertion, and run the plan's
Self Validation against the baselines recorded in task 1.

## Skills Required
`bash` for the source-level invariant checks and clean-install rebuild;
`playwright` for the packaged-application integration comparison.

## Acceptance Criteria
- [ ] `grep -rnE "from '(electron|\\.\\./\\.\\./src/|\\.\\./shared/)" packages/engine/src/` returns no match — nothing in the package reaches the desktop runtime or `src/`.
- [ ] Every remaining non-test module in `src/main/` either imports `electron`, is a re-export shim with a live consumer, or is one of the two recorded exceptions (`relaunch-guard.ts`, `cli.ts`). Produce the list and state which category each falls into.
- [ ] A clean install from an empty state succeeds: `rm -rf node_modules .webpack out && npm ci`, then `npm start` opens a real diff.
- [ ] `npm run test:unit` exits 0 and the executed test-file count equals the task 1 baseline.
- [ ] `npm run test:e2e` (browser project) exits 0.
- [ ] `npm run test:e2e:electron` matches the task 1 baseline scenario by scenario.
- [ ] `git diff -M --stat main...HEAD` shows relocated files as renames, and no relocated file has content changes beyond import lines, the `cli.ts` extraction, and the two shim deletions.
- [ ] The three uncovered desktop paths are exercised by hand and pass: guided mode with a `review.guide.xml` sidecar present, `--staged`, and a forge PR/MR URL.
- [ ] `self-review fetch-comments <URL>` still behaves exactly as before from the packaged binary, including the pre-existing display failure on Linux.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
The Electron feature suite covers error handling, resume, XML output, expand
context, find-in-page and the welcome screen. It covers none of guided mode,
`--staged` or remote PR/MR mode, so for those three the moved modules' unit tests
prove the module works while nothing proves the desktop application still reaches
it. Those three must be exercised manually.

## Input Dependencies
Task 1's baseline file. Tasks 3, 4 and 5 must all be complete.

## Output Artifacts
A validation report stating each check and its result, ready to be quoted in the
pull request description.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Boundary invariant: `grep -rn "electron" packages/engine/src/` must be empty, including transitively — follow every import out of the package and confirm it lands in `packages/core`, `packages/types` or a Node built-in.
2. Directory inventory: for each non-test `.ts` in `src/main/`, print whether it imports `electron`. Expected survivors are `main.ts`, `ipc-handlers.ts`, `version-checker.ts`, `menu.ts`, `app-assets.ts` (Electron-bound), `relaunch-guard.ts` and `cli.ts` (recorded exceptions), and the remaining re-export shims. Confirm each surviving shim still has a consumer; `synthetic-diff.ts` will not, which is pre-existing and expected.
3. Clean install: `rm -rf node_modules .webpack out && npm ci && npm start`. A stale `node_modules` hides exactly the class of resolution error this step exists to catch, so do not skip the removal.
4. Test-file count: run `npm run test:unit` and compare against the baseline. A lower count means relocated tests are no longer being invoked — that is a failure even though every suite is green.
5. Packaged comparison: `npm run test:e2e:electron`, compared against the baseline scenario by scenario. Not a summary count.
6. Rename-detected diff: `git diff -M --stat main...HEAD`, then inspect each relocated file's diff and confirm only import lines differ.
7. Manual desktop checks, each against the packaged binary:
   - place a `review.guide.xml` next to the output path and confirm guided mode renders its groups, per-file descriptions and overview;
   - run with `--staged` in a repository with staged changes and confirm the diff loads;
   - run with a forge PR/MR URL and confirm the remote session opens and threads load.
8. `fetch-comments`: confirm unchanged behaviour, including that it still fails on Linux with no display. That failure is expected and is not this change's to fix.

If any check fails, fix the cause rather than adjusting the check.
</details>
