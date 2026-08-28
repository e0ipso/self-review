---
id: 7
group: "serve-mode"
dependencies: [5]
status: "pending"
created: 2026-08-28
skills:
  - playwright
  - testing
complexity_score: 5
execution_profile: "standard-implementation"
---
# Add a Playwright project covering the full served review loop

## Objective
Prove the whole loop end to end in a real browser: boot serve mode against a real
diff, add a comment, finish the review, and assert the resulting XML on disk.

## Skills Required
`playwright`, extending the existing configuration with a project, and `testing` to
choose assertions that would actually fail if the loop broke.

## Acceptance Criteria
- [ ] A new Playwright project sits alongside the existing `e2e` and `electron` projects in `playwright.config.ts`.
- [ ] The test boots the serve-mode server against a fixture repository state and navigates a browser to it.
- [ ] The test adds a comment to a specific line through the UI.
- [ ] The test finishes the review through the UI.
- [ ] The test asserts the XML file exists on disk and contains the comment body and its line attribute — not merely that the HTTP response was 200.
- [ ] The test asserts the server process exited after the review was finished.
- [ ] Runnable: the new project passes, and `npm run test:e2e` and `npm run test:e2e:electron` still pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Playwright, configured in `playwright.config.ts`, which already defines separate projects
and a BDD-generated test directory for the webapp suite. The existing `e2e` project against
`tests/webapp` is the closest reference.

## Input Dependencies
Task 5's built client and, through it, the whole serve-mode stack.

## Output Artifacts
End-to-end proof that the served UI both renders and saves.

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

**Test philosophy — "write a few tests, mostly integration".**

Meaningful tests verify custom business logic, critical paths, and edge cases
specific to this application. Test *your* code, not the framework or library.

When TO write tests: custom business logic and algorithms; critical user
workflows and data transformations; edge cases and error conditions for core
functionality; integration points between components; complex validation logic.

When NOT to write tests: third-party library functionality; framework features;
simple CRUD without custom logic; trivial getters/setters or static
configuration; obvious functionality that would break immediately if incorrect.

Combine related scenarios into one test rather than one test per method. Favor
integration and critical-path coverage over per-method unit tests.

This is the integration test the philosophy above argues for, and it is the single most valuable
test in this plan: unit tests over routes and adapter can both pass while the loop is broken end to
end, because nothing else asserts that a comment made in a browser reaches a file on disk.

Assert on the artifact, not the transport. A 200 from `POST /api/review` proves the request
succeeded; it does not prove the XML was written, or written correctly. Read the file and assert the
comment body and line attribute are present.

Assert the process exits. Session end is a deliberate design decision in this plan — finishing a
review stops the server — and a regression there would leave orphaned processes behind without
failing anything else.

Study how the existing `e2e` project starts and addresses the webapp before writing the boot logic;
reuse its approach for port handling and readiness rather than inventing a second one. Keep the
fixture repository state small: one file with one changed line is enough to comment on, and a large
diff makes failures harder to read.

</details>
