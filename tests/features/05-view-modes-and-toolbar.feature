Feature: View Modes and Toolbar
  As a developer reviewing code
  I want to switch between diff view modes and control the UI
  So that I can review code in the format I prefer

  Background:
    Given a git repository with changes to the following files:
      | file              | change_type | additions | deletions |
      | src/auth/login.ts | modified    | 10        | 3         |
      | src/config.ts     | modified    | 25        | 0         |
    And I launch self-review

  Scenario: Default view mode is split
    Then the diff viewer should be in "split" view mode
    And the split view should show two columns

  Scenario: Switch to unified view mode
    When I click the "Unified" view mode toggle in the toolbar
    Then the diff viewer should be in "unified" view mode
    And the unified view should show a single column layout

  Scenario: Switch back to split view mode
    When I click the "Unified" view mode toggle in the toolbar
    And I click the "Split" view mode toggle in the toolbar
    Then the diff viewer should be in "split" view mode

  Scenario: Collapse all file sections
    When I click "Collapse all" in the toolbar
    Then all file sections should be collapsed
    And the diff content should not be visible for any file

  Scenario: Expand all file sections
    When I click "Collapse all" in the toolbar
    And I click "Expand all" in the toolbar
    Then all file sections should be expanded

  Scenario: Collapse a single file section
    When I click the collapse toggle on the "src/auth/login.ts" file section header
    Then the "src/auth/login.ts" file section should be collapsed
    And the "src/config.ts" file section should still be expanded

  Scenario: Toolbar displays diff stats summary
    Then the toolbar should show "4 files changed"
    And the toolbar should show additions count "+49"
    And the toolbar should show deletions count "-51"

  Scenario: Toggle theme to dark mode
    When I switch the theme to "Dark" in the toolbar
    Then the application should use dark theme colors

  Scenario: Toggle theme to light mode
    When I switch the theme to "Light" in the toolbar
    Then the application should use light theme colors

  Scenario: Toggle line wrapping off
    Then long lines should be wrapped by default
    When I click the "No Wrap" toggle in the toolbar
    Then long lines should scroll horizontally
    And a horizontal scrollbar should be visible on overflowing lines

  Scenario: Toggle line wrapping back on
    When I click the "No Wrap" toggle in the toolbar
    And I click the "Wrap Lines" toggle in the toolbar
    Then long lines should be wrapped
    And no horizontal scrollbar should be visible

  Scenario: Added files render in unified view when split mode is active
    Given a git repository with changes to the following files:
      | file            | change_type | additions | deletions |
      | src/new-file.ts | added       | 20        | 0         |
      | src/existing.ts | modified    | 5         | 2         |
    And I launch self-review
    Then the diff viewer should be in "split" view mode
    And the "src/existing.ts" file section should use split view
    And the "src/new-file.ts" file section should use unified view

  Scenario: Deleted files render in unified view when split mode is active
    Given a git repository with changes to the following files:
      | file            | change_type | additions | deletions |
      | src/removed.ts  | deleted     | 0         | 15        |
      | src/existing.ts | modified    | 5         | 2         |
    And I launch self-review
    Then the diff viewer should be in "split" view mode
    And the "src/existing.ts" file section should use split view
    And the "src/removed.ts" file section should use unified view
