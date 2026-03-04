Feature: Webapp File Tree Navigation
  As a developer using the ReviewPanel component
  I want to navigate between files using the file tree
  So that I can quickly jump to the files I care about

  Background:
    Given the webapp is loaded with fixture data

  Scenario: Clicking a file in the tree scrolls to that file's section
    When I click "src/config.ts" in the file tree
    Then the diff viewer should scroll to the "src/config.ts" file section
    And the "src/config.ts" entry in the file tree should be highlighted

  Scenario: Scrolling the diff viewer highlights the current file in the tree
    When I scroll the diff viewer to the "src/legacy.ts" file section
    Then the "src/legacy.ts" entry in the file tree should be highlighted

  Scenario: File search filters the file list
    When I type "auth" in the file tree search input
    Then the file tree should list 1 file
    And the file tree should show "src/auth/login.ts"
    And the file tree should not show "README.md"

  Scenario: Clearing file search restores the full list
    When I type "auth" in the file tree search input
    And I clear the file tree search input
    Then the file tree should list 6 files

  Scenario: File search with no matches shows empty list
    When I type "nonexistent" in the file tree search input
    Then the file tree should list 0 files
