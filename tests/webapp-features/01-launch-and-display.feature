Feature: Webapp Launch and Diff Display
  As a developer using the @self-review/react library
  I want the ReviewPanel to render diff data correctly
  So that it works as a standalone webapp component

  Background:
    Given the webapp is loaded with fixture data

  Scenario: ReviewPanel displays diff on load
    Then the file tree should list 6 files
    And the diff viewer should show 6 file sections

  Scenario: File tree shows correct metadata for each file
    Then the file tree entry for "src/auth/login.ts" should show change type "modified"
    And the file tree entry for "src/config.ts" should show change type "modified"
    And the file tree entry for "src/legacy.ts" should show change type "deleted"

  Scenario: Diff viewer renders file sections in order
    Then the diff viewer should show file sections in this order:
      | file                 |
      | README.md            |
      | src/auth/login.ts    |
      | src/config.ts        |
      | src/legacy.ts        |
      | docs/architecture.md |
      | src/new-feature.ts   |

  Scenario: Diff viewer shows syntax-highlighted code
    Then the file section for "src/auth/login.ts" should contain highlighted code lines
    And addition lines should have a green background
    And deletion lines should have a red background

  Scenario: Diff viewer shows hunk headers
    Then the file section for "src/auth/login.ts" should display hunk headers starting with "@@"
