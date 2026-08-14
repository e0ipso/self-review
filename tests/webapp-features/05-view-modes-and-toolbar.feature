Feature: Webapp View Modes and Toolbar
  As a developer using the ReviewPanel component
  I want to switch between diff view modes and control the UI
  So that the toolbar works in the standalone library

  Background:
    Given the webapp is loaded with fixture data

  Scenario: Default view mode is split
    Then the diff viewer should be in "split" view mode
    And the split view should show two columns

  Scenario: Switch to unified view mode
    When I click the "Unified" view mode toggle in the file tree
    Then the diff viewer should be in "unified" view mode
    And the unified view should show a single column layout

  Scenario: Switch back to split view mode
    When I click the "Unified" view mode toggle in the file tree
    And I click the "Split" view mode toggle in the file tree
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

  Scenario: Added files render in unified view when split mode is active
    Then the diff viewer should be in "split" view mode
    And the "src/auth/login.ts" file section should use "split" view
    And the "src/new-feature.ts" file section should use "unified" view

  Scenario: Deleted files render in unified view when split mode is active
    Then the diff viewer should be in "split" view mode
    And the "src/auth/login.ts" file section should use "split" view
    And the "src/legacy.ts" file section should use "unified" view

  Scenario: Toolbar stays pinned when the diff pane scrolls
    When I scroll the diff pane to the bottom
    Then the toolbar should remain anchored at the top of the viewport
    And the document itself should not have scrolled
