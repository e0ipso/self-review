Feature: Empty Diff Help Message
  As a developer using the @self-review/react library
  I want to see a help message when the diff is empty
  So that I understand what arguments to use

  Scenario: Help message is displayed when diff is empty
    Given the webapp is loaded with an empty diff
    Then the diff viewer should display an empty diff help message
    And the help message should explain that arguments are passed to git diff

  Scenario: Help message shows common usage examples
    Given the webapp is loaded with an empty diff
    Then the help message should include the following examples:
      | command                    | description                              |
      | self-review                | Unstaged working tree changes (default)  |
      | self-review --staged       | Changes staged for commit                |
      | self-review HEAD~1         | Changes in the last commit               |
      | self-review main..HEAD     | All changes since branching from main    |
      | self-review -- src/        | Limit diff to a specific directory       |

  Scenario: Help message shows the arguments that were used
    Given the webapp is loaded with an empty diff and arguments "--staged"
    Then the help message should show that the arguments "--staged" were passed to git diff
    And the help message should suggest trying different arguments

  Scenario: Help message is not displayed when diff has files
    Given the webapp is loaded with fixture data
    Then the diff viewer should not display an empty diff help message

  Scenario: File tree shows empty state alongside help message
    Given the webapp is loaded with an empty diff
    Then the file tree should display the message "No files in diff"
    And the file tree file count badge should show 0
