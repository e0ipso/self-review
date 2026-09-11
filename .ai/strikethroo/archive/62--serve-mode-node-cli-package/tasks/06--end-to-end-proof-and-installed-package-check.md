---
id: 6
group: "serve-mode-node-cli-package"
dependencies: [4, 5]
status: "completed"
created: 2026-09-09
skills:
  - playwright
  - testing
complexity_score: 5
execution_profile: "standard-implementation"
---
# End-to-end proof and installed-package check

## Objective
Drive the running program through a real browser and assert the artifact it
writes, then prove the package works when installed from a tarball outside the
workspace.

## Skills Required
`playwright` for the browser project; `testing` for the tarball installation
check.

## Acceptance Criteria
- [ ] A Playwright project starts the built executable against a fixture repository, opens the served URL, comments on a line, completes the review, and then asserts the output file on disk and that the process exited.
- [ ] The assertion is on the written file, not on the HTTP response. A 200 proves the request worked, not that the file was written.
- [ ] The output file for a given repository state is equivalent to what the desktop application produces for the same state.
- [ ] The fixture starts the program as an ordinary child process. `grep -rn "detached" tests/` returns nothing for this project.
- [ ] `npm pack --workspace @self-review/serve`, installed into a directory outside the workspace, runs the executable there and serves a review — resolving `@self-review/core` and `@self-review/react` from that installation rather than from the workspace.
- [ ] The packed tarball's declared version and dependency ranges are inspected and recorded.

## Technical Requirements
A package can work inside the workspace and still be broken from a registry,
through a missing file, an unbuilt asset, or a dependency range that only
resolves through the workspace symlinks. The tarball check is the only thing that
catches that class before a release does.

The existing Playwright configuration defines projects for `electron`, `e2e`,
`recording` and `screenshots`. Add one; do not repurpose an existing one.

## Input Dependencies
Task 4's executable and task 5's client — the whole program must run.

## Output Artifacts
A Playwright project and fixture, plus a recorded result from the installed-
tarball run.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Read `playwright.config.ts` for how the existing projects are declared, and `tests/features/` for how the Electron project builds a fixture repository. Reuse the fixture approach rather than inventing one.
2. Add a project for serve mode. Its fixture: create a temporary git repository with a known diff, run the built executable against it with an output path in the temp directory, capture the URL from stderr, and hand it to the browser.
3. Start the executable with an ordinary `spawn`. Do not pass `detached`. The plan calls its presence evidence that the program has moved back inside the desktop binary.
4. The scenario: open the URL, add a comment on a changed line, complete the review. Then — after the process exits — read the output file from disk and assert its content. Do not assert on the HTTP response and call it proven.
5. Equivalence with the desktop: generate a review over the same fixture through the desktop application, and compare the two output files. They should differ only where the plan says they legitimately do; if they differ anywhere else, that is a finding, not something to normalise away in the test.
6. Installed-tarball check: `npm pack --workspace @self-review/serve`, `npm install` the tarball into a scratch directory outside the repository, run the executable there against a scratch repository, and confirm it serves. Then inspect the tarball's `package.json` for its version and its `@self-review/*` ranges.
7. Record the tarball inspection result in the pull request; it is the evidence for the plan's installability criterion.

Test the critical path — serve, comment, submit, artifact — not every UI
interaction. The React components have their own suites and the webapp project
already covers the interface in isolation.
</details>
