Feature: Expand Context
  As a developer reviewing code
  I want to expand context around diff hunks
  So that I can see more surrounding code for better understanding

  Background:
    Given a git repository with changes to the following files:
      | file              | change_type | additions | deletions |
      | src/auth/login.ts | modified    | 10        | 3         |
      | src/config.ts     | modified    | 25        | 0         |

  Scenario: Expand context bars appear for modified files in git mode
    And I launch self-review
    Then expand context bars should be visible in the "src/auth/login.ts" file section

  Scenario: Expand context bars do not appear for untracked files
    And I launch self-review
    Then expand context bars should not be visible in the "src/new-feature.ts" file section

  Scenario: Clicking expand down loads more context lines below a hunk
    And I launch self-review
    Then I should see diff lines in the "src/auth/login.ts" file section
    When I click the first expand-down button in the "src/auth/login.ts" file section
    Then the "src/auth/login.ts" file section should have more context lines than before

  Scenario: Expand bars disappear when no more lines remain
    And I launch self-review
    When I click "show all" on an expand bar in the "src/auth/login.ts" file section
    Then expand context bars should not be visible in the "src/auth/login.ts" file section
