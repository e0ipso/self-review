Feature: Resume from Prior Review
  As a developer continuing a review session
  I want to resume from a previously exported XML review
  So that I can add to or edit my prior feedback

  Background:
    Given a git repository with staged changes to the following files:
      | file              | change_type | additions | deletions |
      | src/auth/login.ts | modified    | 10        | 3         |
      | src/config.ts     | added       | 25        | 0         |

  Scenario: Resume loads prior comments into the UI
    Given a prior review XML file "review.xml" with these comments:
      | file              | new_line_start | new_line_end | body            | category |
      | src/auth/login.ts | 5              | 5            | Fix this typo   | nit      |
      | src/auth/login.ts |                |              | Needs refactor  |          |
    When I launch self-review with "--staged --resume-from review.xml"
    Then the comment "Fix this typo" should be displayed at new line 5 of "src/auth/login.ts"
    And the file-level comment "Needs refactor" should be displayed on "src/auth/login.ts"

  Scenario: Resumed comments can be edited
    Given a prior review XML file "review.xml" with these comments:
      | file              | new_line_start | new_line_end | body          |
      | src/auth/login.ts | 5              | 5            | Original text |
    When I launch self-review with "--staged --resume-from review.xml"
    And I click "Edit" on the comment "Original text"
    And I replace the text with "Updated text"
    And I click "Add comment"
    Then the comment should show "Updated text"

  Scenario: Resumed comments can be deleted
    Given a prior review XML file "review.xml" with these comments:
      | file              | new_line_start | new_line_end | body       |
      | src/auth/login.ts | 5              | 5            | Delete me  |
    When I launch self-review with "--staged --resume-from review.xml"
    And I click "Delete" on the comment "Delete me"
    And I close the Electron window
    Then the XML output should contain 0 comments for "src/auth/login.ts"

  Scenario: New comments can be added alongside resumed comments
    Given a prior review XML file "review.xml" with these comments:
      | file              | new_line_start | new_line_end | body          |
      | src/auth/login.ts | 5              | 5            | Prior comment |
    When I launch self-review with "--staged --resume-from review.xml"
    And I add a comment "New comment" on new line 10 of "src/auth/login.ts"
    And I close the Electron window
    Then the XML output should contain 2 comments for "src/auth/login.ts"

  Scenario: Resume with invalid XML file exits with error
    Given a file "bad-review.xml" containing "not valid xml {"
    When I launch self-review with "--staged --resume-from bad-review.xml"
    Then the process should exit with code 1
    And stderr should contain an error message about invalid XML

  Scenario: Resume with nonexistent file exits with error
    When I launch self-review with "--staged --resume-from nonexistent.xml"
    Then the process should exit with code 1
    And stderr should contain an error message about the file not being found
