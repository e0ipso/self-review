---
id: 9
group: "testing"
dependencies: [5, 6, 7, 4]
status: "completed"
created: "2026-02-16"
skills:
  - playwright
  - e2e-testing
---

# Add E2E Tests for Welcome Screen and Directory Mode

## Objective

Create a new Cucumber BDD feature file with Playwright step definitions covering the welcome screen display, directory mode file loading, and XML output for directory mode.

## Skills Required

- Playwright + Cucumber BDD e2e testing for Electron apps

## Acceptance Criteria

- [ ] `tests/features/11-welcome-screen.feature` exists with scenarios covering all key flows
- [ ] `tests/steps/11-welcome-screen.steps.ts` exists with step definitions
- [ ] Scenario: Welcome screen appears when launched outside a git repo with no path argument
- [ ] Scenario: After selecting a directory, files appear in review UI as "added"
- [ ] Scenario: Toolbar shows directory path instead of git diff args
- [ ] Scenario: Finish Review produces valid XML with `source-path` and no `git-diff-args`
- [ ] Scenario: Launching with a non-git directory path argument skips welcome screen, goes straight to directory mode
- [ ] Scenario: Binary files in directory mode show "Binary file" indicator
- [ ] Scenario: Existing git-based scenarios still pass (regression guard — run full suite)
- [ ] Tests use `data-testid` selectors for welcome screen elements
- [ ] Tests follow existing patterns from other step definition files
- [ ] Tests create temporary non-git directories as fixtures

## Technical Requirements

- Use `createBdd()` from `playwright-bdd` (match existing test patterns)
- Use `data-testid` selectors for all welcome screen interactions
- Use `launchApp()` / `launchAppExpectExit()` from existing test helpers
- Mock Electron's native directory dialog in Playwright using `electronApp.evaluate()`
- Create temporary test directories with known file contents as fixtures
- Clean up test directories after each scenario

### Meaningful Test Strategy Guidelines

**Definition of "Meaningful Tests":**
Tests that verify custom business logic, critical paths, and edge cases specific to the application. Focus on testing YOUR code, not the framework or library functionality.

**When TO Write Tests:**
- Custom business logic and algorithms
- Critical user workflows and data transformations
- Edge cases and error conditions for core functionality
- Integration points between different system components
- Complex validation logic or calculations

**When NOT to Write Tests:**
- Third-party library functionality (already tested upstream)
- Framework features (React hooks, Express middleware, etc.)
- Simple CRUD operations without custom logic
- Configuration files or static data

**Test Task Creation Rules:**
- Combine related test scenarios into single tasks
- Focus on integration and critical path testing over unit test coverage
- Avoid creating separate tasks for testing each CRUD operation individually

## Input Dependencies

- Task 4: XSD + serializer must support `source-path` attribute
- Task 5: Startup flow must support welcome mode and directory mode
- Task 6: Welcome screen component must exist with `data-testid` attributes
- Task 7: Toolbar and DiffViewer must display mode-appropriate content

## Output Artifacts

- New `tests/features/11-welcome-screen.feature`
- New `tests/steps/11-welcome-screen.steps.ts`
- Any test helper additions (e.g., temp directory fixture utilities)

## Implementation Notes

<details>

1. **Read existing e2e test patterns**: Look at `tests/features/01-launch-and-display.feature` and `tests/steps/` to understand the BDD style, step definition patterns, and app launch helpers.

2. **Feature file structure** (`tests/features/11-welcome-screen.feature`):
   ```gherkin
   Feature: Welcome Screen and Directory Mode

     Scenario: Welcome screen appears when no git context
       Given the app is launched outside a git repository
       Then the welcome screen should be visible
       And the browse button should be visible

     Scenario: Directory mode loads all files as additions
       Given a temporary directory with sample files
       When the app is launched with the directory path
       Then all files should appear as added in the file tree
       And the toolbar should show the directory path

     Scenario: Directory mode XML output
       Given a review is completed in directory mode
       When the review is finished
       Then the XML output should contain source-path attribute
       And the XML output should not contain git-diff-args
       And the XML output should not contain repository attribute

     # Additional scenarios as needed...
   ```

3. **Step definitions** (`tests/steps/11-welcome-screen.steps.ts`):
   - Import `createBdd` from `playwright-bdd`
   - Use existing `launchApp()` helper, but pass options to launch without git context
   - Create temp directories using `fs.mkdtemp` with known files (e.g., `hello.txt`, `binary.bin`)
   - Mock Electron dialog: `electronApp.evaluate(() => { require('electron').dialog.showOpenDialog = async () => ({ canceled: false, filePaths: ['/path/to/temp'] }); })`
   - Use `data-testid` selectors: `page.getByTestId('welcome-screen')`, `page.getByTestId('browse-button')`
   - Clean up temp directories in After hooks

4. **Testing environment**: These tests CANNOT run in the dev container (per project guidance). Write them to run on the host machine using the existing Playwright Electron harness.

5. **Regression guard**: The step definitions should not modify any existing test infrastructure. Run the full e2e suite to verify existing tests still pass.

6. **Dialog mocking**: The trickiest part is intercepting Electron's native dialog. Use `electronApp.evaluate()` to override `dialog.showOpenDialog` before triggering the browse action. Alternatively, check if the project has an existing dialog mocking pattern.

</details>
