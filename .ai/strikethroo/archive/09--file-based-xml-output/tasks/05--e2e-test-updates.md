---
id: 5
group: 'testing'
dependencies: [2, 3]
status: 'completed'
created: '2026-02-12'
skills:
  - playwright
  - e2e-testing
---

# Update E2E tests for file-based output and close confirmation dialog

## Objective

Update E2E feature files and step definitions to test file-based XML output instead of stdout capture. Update close-related steps to use the new save-and-quit IPC flow. Add test scenarios for the close confirmation dialog behavior.

**Meaningful Test Strategy Guidelines**

Your critical mantra for test generation is: "write a few tests, mostly integration".

**When TO Write Tests:**
- Custom business logic and algorithms
- Critical user workflows and data transformations
- Edge cases and error conditions for core functionality
- Integration points between different system components

**When NOT to Write Tests:**
- Third-party library functionality
- Framework features
- Simple CRUD operations without custom logic
- Obvious functionality that would break immediately if incorrect

## Skills Required

Playwright for Electron E2E testing. Cucumber/Gherkin BDD feature file syntax. Understanding of the Electron test harness.

## Acceptance Criteria

- [ ] `tests/features/07-xml-output.feature`: All "stdout should contain" assertions replaced with file-based assertions (e.g., "the output file should contain valid XML")
- [ ] `tests/features/07-xml-output.feature`: "Nothing is written to stdout except XML" scenario becomes "Nothing is written to stdout"
- [ ] `tests/features/08-resume.feature`: "the XML output" references updated to reference the output file
- [ ] Step definitions: "I close the Electron window" triggers save-and-quit flow (not raw window close that triggers dialog)
- [ ] Step definitions: file reading replaces stdout capture for XML assertion steps
- [ ] All E2E tests pass when run on the host machine (`npm run test:e2e`)

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Playwright Electron testing
- Cucumber step definitions (likely in `tests/steps/` or similar)
- Node.js `fs.readFileSync` for reading the output file in assertions
- Understanding of the project's E2E test infrastructure

## Input Dependencies

- Task 2: Main process file-based save flow (the behavior being tested)
- Task 3: Renderer close dialog and Finish Review button (UI behavior being tested)

## Output Artifacts

- Updated `tests/features/07-xml-output.feature`
- Updated `tests/features/08-resume.feature`
- Updated step definitions (find the relevant step definition files first)

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Important: Dev Container Caveat

E2E tests CANNOT run inside the dev container. Check if you're in the dev container before attempting to run them. If you are, note that changes should be validated on the host machine.

### Step 1: Explore the test infrastructure

Before making changes, read:
1. The step definition files (likely in `tests/steps/` or `tests/support/`)
2. The test helper/support files to understand how the Electron app is launched and how stdout is currently captured

Use glob patterns like `tests/**/*.ts` and `tests/**/*.js` to find all test infrastructure files.

### Step 2: Update `tests/features/07-xml-output.feature`

**Scenario: Empty review produces valid XML with all files**
- Change `Then stdout should contain valid XML` → `Then the output file should contain valid XML`
- Change `And I close the Electron window` to use the save-and-quit path. The step might need to click "Finish Review" instead of closing the window, OR the existing "close" step needs to be updated to trigger save-and-quit.

**Scenario: Nothing is written to stdout except XML** (last scenario)
- Change to:
```gherkin
Scenario: Nothing is written to stdout
  When I launch self-review
  And I click "Finish Review"
  Then stdout should be empty
  And the output file should exist
```

**All other scenarios that have `And I close the Electron window`**
- These should use the save flow. Either:
  a. Replace `And I close the Electron window` with `And I click "Finish Review"`, or
  b. Update the "close" step definition to trigger `saveAndQuit()` instead of `window.close()`

Option (b) is simpler and has less feature file churn. The step "I close the Electron window" semantically means "end the review" — making it call saveAndQuit is appropriate.

### Step 3: Update `tests/features/08-resume.feature`

**Scenario: Resumed comments can be deleted**
- `Then the XML output should contain 0 comments for "src/auth/login.ts"` → `Then the output file should contain 0 comments for "src/auth/login.ts"`

**Scenario: New comments can be added alongside resumed comments**
- `Then the XML output should contain 2 comments for "src/auth/login.ts"` → `Then the output file should contain 2 comments for "src/auth/login.ts"`

### Step 4: Update step definitions

Find the step definition that implements `And I close the Electron window`. It currently likely does `window.close()` or similar. Update it to:

1. Click the "Finish Review" button, OR
2. Execute `window.electronAPI.saveAndQuit()` via Playwright's `evaluate`

For XML assertion steps that currently read from captured stdout, update them to read the output file:
- Determine the expected output file path (default `./review.xml`, relative to the test's working directory)
- Read the file with `fs.readFileSync`
- Parse and assert as before

Add new step definitions:
- `Then the output file should contain valid XML` — reads `./review.xml` and validates
- `Then the output file should exist` — checks file exists
- `Then stdout should be empty` — asserts captured stdout is empty string
- `Then the output file should contain {int} comments for {string}` — reads and parses XML, counts comments

### Key consideration: test working directory

The output file defaults to `./review.xml` relative to `process.cwd()`. In the E2E test setup, the app is likely launched from a specific directory (the test fixture repo). The output file will be written there. Make sure the step definitions know where to look for the file.

Also consider cleanup: add a hook to delete the output file after each scenario to prevent stale data from affecting subsequent tests.

</details>
