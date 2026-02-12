Feature: Empty Diff Help Message
  As a developer launching self-review with no changes
  I want to see a help message explaining how CLI arguments work
  So that I can understand what arguments to use to see my changes

  Scenario: Help message is displayed when diff is empty
    Given a git repository with no changes
    When I launch self-review
    Then the diff viewer should display an empty diff help message
    And the help message should explain that arguments are passed to git diff

  Scenario: Help message shows common usage examples
    Given a git repository with no changes
    When I launch self-review
    Then the help message should include the following examples:
      | command                    | description                              |
      | self-review                | Unstaged working tree changes (default)  |
      | self-review --staged       | Changes staged for commit                |
      | self-review HEAD~1         | Changes in the last commit               |
      | self-review main..HEAD     | All changes since branching from main    |
      | self-review -- src/        | Limit diff to a specific directory       |

  Scenario: Help message shows the arguments that were used
    Given a git repository with no changes matching "--staged"
    When I launch self-review with "--staged"
    Then the help message should show that the arguments "--staged" were passed to git diff
    And the help message should suggest trying different arguments

  Scenario: Help message is not displayed when diff has files
    Given a git repository with changes to the following files:
      | file          | change_type | additions | deletions |
      | src/index.ts  | modified    | 5         | 2         |
    When I launch self-review
    Then the diff viewer should not display an empty diff help message
    And the diff viewer should show 4 file sections

  Scenario: File tree shows empty state alongside help message
    Given a git repository with no changes
    When I launch self-review
    Then the file tree should display the message "No files in diff"
    And the file tree file count badge should show 0

  Scenario: Empty diff with arguments still produces valid XML on close
    Given a git repository with no changes matching "--staged"
    When I launch self-review with "--staged"
    And I click "Finish Review"
    Then the output file should contain valid XML
    And the XML should contain 0 file elements
    And the process should exit with code 0
