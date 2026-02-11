Feature: Commenting System
  As a developer reviewing code
  I want to leave comments on specific lines and files
  So that I can provide structured feedback to my AI agent

  Background:
    Given a git repository with changes to the following files:
      | file              | change_type | additions | deletions |
      | src/auth/login.ts | modified    | 10        | 3         |
      | src/config.ts     | modified    | 25        | 0         |
    And the project has these comment categories:
      | name     | color   |
      | bug      | #e53e3e |
      | nit      | #718096 |
      | question | #805ad5 |
    And I launch self-review

  Scenario: Add a single-line comment on an added line
    When I click the line number for new line 5 in "src/auth/login.ts"
    Then a comment input box should appear below that line
    When I type "This variable name is misleading" in the comment input
    And I click "Add comment"
    Then a comment should be displayed below new line 5 of "src/auth/login.ts"
    And the comment should show "This variable name is misleading"
    And the file tree entry for "src/auth/login.ts" should show comment count 1

  Scenario: Add a file-level comment
    When I click "Add file comment" on the "src/auth/login.ts" file section header
    Then a comment input box should appear at the top of the file section
    When I type "This file needs refactoring" in the comment input
    And I click "Add comment"
    Then a file-level comment should be displayed at the top of the "src/auth/login.ts" section
    And the comment should show "This file needs refactoring"

  Scenario: Add a comment with a category
    When I click the line number for new line 5 in "src/auth/login.ts"
    And I select category "bug" in the comment input
    And I type "Null reference possible here" in the comment input
    And I click "Add comment"
    Then the displayed comment should show a "bug" category badge

  Scenario: Edit an existing comment
    Given I have added a comment "Original text" on new line 5 of "src/auth/login.ts"
    When I click "Edit" on that comment
    Then the comment should become an editable input pre-filled with "Original text"
    When I replace the text with "Updated text"
    And I click "Add comment"
    Then the comment should show "Updated text"

  Scenario: Delete a comment
    Given I have added a comment "Delete me" on new line 5 of "src/auth/login.ts"
    When I click "Delete" on that comment
    Then the comment should be removed
    And the file tree entry for "src/auth/login.ts" should show comment count 0

  Scenario: Cancel adding a comment
    When I click the line number for new line 5 in "src/auth/login.ts"
    And I type "Nevermind" in the comment input
    And I click "Cancel"
    Then no comment should be displayed below new line 5

  Scenario: Add a multi-line comment
    When I select line numbers from new line 10 to new line 15 in "src/auth/login.ts"
    Then a comment input box should appear below new line 15
    When I type "This whole block needs error handling" in the comment input
    And I click "Add comment"
    Then lines 10 through 15 should be visually highlighted
    And a comment should be displayed below new line 15

  Scenario: Comment on a deleted line
    When I click the line number for old line 8 in "src/auth/login.ts"
    Then a comment input box should appear below that line
    When I type "Why was this removed?" in the comment input
    And I click "Add comment"
    Then a comment should be displayed below old line 8 of "src/auth/login.ts"
