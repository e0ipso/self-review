---
id: 1
group: "verification-baseline"
dependencies: []
status: "completed"
created: 2026-09-02
skills:
  - playwright
complexity_score: 4
complexity_notes: "Mechanically simple but has a hard ordering constraint: it is only valid while the working tree is unmodified, so it cannot be re-run later to recover a missed baseline."
execution_profile: "standard-implementation"
---
# Capture the packaged-application suite baseline before any code changes

## Objective

Record which scenarios of the packaged-application integration suite pass and
which fail on the unmodified code, so the same run after the extraction can be
compared scenario by scenario. Success Criterion 6 requires that comparison, and
Self Validation step 1 requires the baseline to exist before any code is touched.

This suite does not run in continuous integration, so this recorded baseline is
the only evidence available that the refactor did not regress the packaged
desktop application.

## Skills Required

- `playwright` — running a Playwright project against a packaged Electron
  application under a virtual framebuffer, and reading its per-scenario results.

## Acceptance Criteria

- [ ] `git status --porcelain` reports no modifications outside `.ai/strikethroo`
      at the moment the suite is started. Record the output.
- [ ] `npm run test:e2e:electron` has been run to completion and its full output
      captured to `.ai/strikethroo/plans/60--extract-transport-agnostic-review-handlers/baseline-electron.txt`.
- [ ] That file records, for every scenario, its name and whether it passed or
      failed, plus the final Playwright summary line (for example
      `N passed, M failed`).
- [ ] The head commit the baseline was taken at is recorded at the top of the
      file, from `git rev-parse HEAD`.
- [ ] Any scenario that fails is recorded as a **pre-existing** failure rather
      than treated as a blocker. A red baseline is a valid baseline.

## Technical Requirements

- The suite is the `electron` Playwright project. The repository script is
  `npm run test:e2e:electron`, which expands to
  `npm run package && npx bddgen && xvfb-run --auto-servernum npx playwright test --project electron`.
- Packaging is required; the suite drives the packaged binary, not the dev build.
- A display is required. `xvfb-run` is already part of the script; do not remove it.
- The run is slow. Allow for a long timeout rather than killing it early. A
  truncated run is not a baseline.

## Input Dependencies

None. This task must run first, against unmodified code.

## Output Artifacts

- `.ai/strikethroo/plans/60--extract-transport-agnostic-review-handlers/baseline-electron.txt`
  — the recorded per-scenario baseline, consumed by task 7.

## Implementation Notes

<details>
<summary>Step by step</summary>

1. Confirm the tree is clean apart from the planning workspace:

   ```bash
   git status --porcelain | grep -v '^?? \.ai/strikethroo/' || echo 'clean'
   git rev-parse HEAD
   ```

   If anything else is modified, stop and report. The baseline is only
   meaningful against unmodified code.

2. Run the suite, capturing everything:

   ```bash
   npm run test:e2e:electron 2>&1 | tee /tmp/baseline-electron-raw.txt
   ```

   Expect this to take many minutes. Do not interrupt it. A non-zero exit code
   is an acceptable outcome; capture it rather than retrying.

3. Write the artifact. Start it with the commit and the date, then the summary
   line, then one line per scenario with its status. The raw Playwright output
   may be appended below a `---` separator. The point of the file is that a
   human, and task 7, can answer "did scenario X pass before?" without rerunning
   anything.

4. Do not attempt to fix a failing scenario. Pre-existing failures are exactly
   what this baseline exists to distinguish from regressions. Note in the file
   that the `fetch-comments` subcommand is known to fail on a machine with no
   display and is explicitly out of scope for this plan.

</details>

**If the suite cannot run at all** (no `xvfb`, packaging fails, no display),
do not silently skip it. Record the failure and its exact error in the artifact
file and report it. Task 7 then has no baseline to compare against, which is a
finding the plan needs to surface rather than something to work around.
