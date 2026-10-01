Feature: Quit and save recovery
  As a developer reviewing code in self-review
  I want every way out of the app to protect my unsaved review
  So that a quit shortcut or a failed save never loses my comments

  Background:
    Given a git repository with changes to the following files:
      | file              | change_type | additions | deletions |
      | src/auth/login.ts | modified    | 10        | 3         |
      | src/config.ts     | modified    | 25        | 0         |

  Scenario: Menu Quit asks before leaving a review, and Cancel keeps the session
    When I launch self-review
    And I add a comment "Keep me" on new line 5 of "src/auth/login.ts"
    And I quit through the application menu
    Then the close confirmation dialog should be visible
    When I choose "Cancel" in the close confirmation dialog
    Then the close confirmation dialog should be closed
    And the app should still be running
    And the comment should show "Keep me"
    And the output file should not exist

  Scenario: A save into a directory reports the error and keeps the review until the path is fixed
    When I launch self-review
    And native message boxes are captured instead of shown
    And I add a comment "Survives a failed save" on new line 5 of "src/auth/login.ts"
    And the output path is replaced by a directory containing "keep.txt"
    And I press the Finish Review button
    Then a save error dialog should report "output-is-directory"
    And the app should still be running
    And the comment should show "Survives a failed save"
    And the output path should still be a directory containing "keep.txt"
    When I change the output path to "fixed/review.xml"
    And I quit through the application menu
    And I choose "Save & Quit" in the close confirmation dialog
    Then the app should exit with code 0
    And the review file "fixed/review.xml" should contain a comment with body "Survives a failed save"
    And the output path should still be a directory containing "keep.txt"

  Scenario: Discard quits without writing
    When I launch self-review
    And I add a comment "Throw me away" on new line 5 of "src/auth/login.ts"
    And I quit through the application menu
    And I choose "Discard" in the close confirmation dialog
    Then the app should exit with code 0
    And the output file should not exist
