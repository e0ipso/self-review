---
id: 1
group: "shared-engine-workspace-package"
dependencies: []
status: "completed"
created: 2026-09-04
skills:
  - playwright
  - vitest
complexity_score: 3
execution_profile: "standard-implementation"
---
# Record pre-change validation baselines

## Objective
Capture the packaged-application integration result and the executed unit-test
file count on the unmodified default branch, so the same measurements after the
move have something to be compared against.

## Skills Required
`playwright` to run the packaged Electron integration project; `vitest` to count
the unit test files that actually execute.

## Acceptance Criteria
- [ ] `npm run test:e2e:electron` has been run on an unmodified checkout of `main` and its scenario-by-scenario result is written to a baseline file outside the repository working tree.
- [ ] `npm run test:unit` has been run on the same unmodified checkout and the number of executed test files is recorded in the same baseline file.
- [ ] The baseline file records the commit SHA it was taken at, and that SHA matches `git rev-parse HEAD`.
- [ ] `git status --porcelain` reports no modifications to tracked files, proving the baseline was taken before any change.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Runs against the default branch as-is. The Electron project requires packaging
and a display: `npm run test:e2e:electron` runs `npm run package` then
`xvfb-run --auto-servernum npx playwright test --project electron`. This cannot
run inside the dev container — verify you are on the host before starting.

## Input Dependencies
None. This is the first task and must precede every file modification.

## Output Artifacts
A baseline file (suggested: `/tmp/plan-61-baseline.txt`) holding the commit SHA,
the per-scenario Electron integration results, and the executed unit-test file
count. Task 6 consumes it.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Confirm you are not in the dev container: `[ -f /.dockerenv ] && echo IN CONTAINER`. If it prints, stop and tell the user the baseline must be taken on the host.
2. Confirm a clean tree: `git status --porcelain` must print nothing.
3. Record the SHA: `git rev-parse HEAD >> /tmp/plan-61-baseline.txt`.
4. Run `npm run test:unit 2>&1 | tee /tmp/plan-61-unit-before.txt`. Extract the executed test-file count from vitest's summary line (the `Test Files  N passed` figure) for each of the three configurations it runs, and append all three to the baseline file. There are three because the root script runs the main config, the renderer config, and the `@self-review/core` workspace.
5. Run `npm run test:e2e:electron 2>&1 | tee /tmp/plan-61-e2e-before.txt`. Append the per-scenario pass/fail list to the baseline file. Do not summarise it to a single number — task 6 compares scenario by scenario.
6. Leave the working tree untouched.

Do not fix anything you find failing here. A pre-existing failure is part of the
baseline; the point is comparison, not green.
</details>
