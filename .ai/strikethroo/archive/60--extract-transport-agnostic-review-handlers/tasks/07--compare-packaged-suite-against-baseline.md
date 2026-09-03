---
id: 7
group: "verification"
dependencies: [1, 4, 5]
status: "completed"
created: 2026-09-02
skills:
  - playwright
complexity_score: 4
execution_profile: "standard-implementation"
---
# Re-run the packaged suite and compare against the baseline

## Objective

Run the packaged-application integration suite against the changed code, on the
same fixture as task 1, and compare scenario by scenario. Any scenario that
passed before and fails after is a regression and blocks completion. This closes
Success Criterion 6 and Self Validation step 3.

## Skills Required

- `playwright` — running the packaged Electron project and reading per-scenario
  results.

## Acceptance Criteria

- [ ] `npm run test:e2e:electron` has been run to completion on the changed code
      and its output captured to
      `.ai/strikethroo/plans/60--extract-transport-agnostic-review-handlers/after-electron.txt`,
      with the head commit recorded at the top.
- [ ] Every scenario in the baseline is accounted for in a written comparison:
      passed before and after; failed before and after; or changed state.
- [ ] **No scenario passed in the baseline and fails now.** If one does, stop.
      Do not adjust the test, do not re-run hoping for a different result, and do
      not mark the task complete. Report the scenario, its failure output, and
      which extraction task most plausibly caused it.
- [ ] A scenario that failed in the baseline and passes now is recorded as such
      and is not treated as a problem.
- [ ] `npm run test:unit` and `npm run test:e2e` both pass on the same tree.

## Technical Requirements

- Use the same repository fixture as task 1. A different fixture makes the
  comparison meaningless.
- The suite is slow and requires packaging plus `xvfb`. Allow a long timeout.
- Playwright's own retry behaviour can mask a flaky failure as a pass. If a
  scenario needed a retry, record that; a scenario that passes only on retry is
  not the same result as one that passed first time in the baseline.

## Input Dependencies

- Task 1: `baseline-electron.txt`.
- Tasks 4 and 5: the completed extraction and its unit coverage.

## Output Artifacts

- `.ai/strikethroo/plans/60--extract-transport-agnostic-review-handlers/after-electron.txt`
- A written before/after comparison in the task report.

## Implementation Notes

<details>
<summary>If task 1 produced no baseline</summary>

If the baseline run could not execute, there is nothing to compare against and
this task cannot deliver what it exists to deliver. Say so plainly in the task
report rather than substituting a weaker check and calling it done. Run the
suite anyway and record the result, then state explicitly that it is
uncorroborated and that Success Criterion 6 is unmet. The plan's whole
verification strategy for "observable behaviour is unchanged" rests on this
comparison, and quietly downgrading it would leave the pull request claiming
something no one checked.

</details>

<details>
<summary>Known pre-existing failure</summary>

The `fetch-comments` subcommand is known to fail on a machine with no display.
The plan places it explicitly out of scope. If it fails in both runs, that is a
match, not a regression. Do not attempt to fix it here.

</details>

Both artifact files live under `.ai/strikethroo/`, which Success Criterion 7
excludes from the pull request. Confirm before finishing that
`git status --porcelain` shows no planning-workspace file staged for commit.
