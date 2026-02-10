Feature: App Launch and Diff Display
  As a developer reviewing AI-generated code
  I want to launch self-review and see my git diff rendered
  So that I can begin reviewing changes

  Background:
    Given a git repository with staged changes to the following files:
      | file              | change_type | additions | deletions |
      | src/auth/login.ts | modified    | 10        | 3         |
      | src/config.ts     | added       | 25        | 0         |
      | src/legacy.ts     | deleted     | 0         | 40        |
      | README.md         | modified    | 2         | 1         |

  Scenario: App displays diff on launch
    When I launch self-review with "--staged"
    Then the Electron window should be visible
    And the file tree should list 4 files
    And the diff viewer should show 4 file sections

  Scenario: File tree shows correct metadata for each file
    When I launch self-review with "--staged"
    Then the file tree entry for "src/auth/login.ts" should show change type "modified"
    And the file tree entry for "src/auth/login.ts" should show "+10 -3"
    And the file tree entry for "src/config.ts" should show change type "added"
    And the file tree entry for "src/legacy.ts" should show change type "deleted"

  Scenario: Diff viewer renders file sections in order
    When I launch self-review with "--staged"
    Then the diff viewer should show file sections in this order:
      | file              |
      | README.md         |
      | src/auth/login.ts |
      | src/config.ts     |
      | src/legacy.ts     |

  Scenario: Diff viewer shows syntax-highlighted code
    When I launch self-review with "--staged"
    Then the file section for "src/auth/login.ts" should contain highlighted code lines
    And addition lines should have a green background
    And deletion lines should have a red background

  Scenario: Diff viewer shows hunk headers
    When I launch self-review with "--staged"
    Then the file section for "src/auth/login.ts" should display hunk headers starting with "@@"

  Scenario: App exits with code 0 on window close
    When I launch self-review with "--staged"
    And I close the Electron window
    Then the process should exit with code 0
