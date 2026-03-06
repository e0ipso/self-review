Feature: Webapp Commenting System
  As a developer using the ReviewPanel component
  I want to leave comments on specific lines and files
  So that the commenting system works in the standalone library

  Background:
    Given the webapp is loaded with commenting categories

  # --- Single-Line Comment ---

  Scenario: Add a single-line comment via icon click
    When I click the "+" icon on new line 5 in "src/auth/login.ts"
    Then a comment input box should appear below that line
    And the comment input header should show "Comment on line 5"
    When I type "This variable name is misleading" in the comment input
    And I click "Comment"
    Then a comment should be displayed below new line 5 of "src/auth/login.ts"
    And the comment should show "This variable name is misleading"
    And the comment header should show "line 5"
    And the file tree entry for "src/auth/login.ts" should show comment count 1

  # --- File-Level Comments ---

  Scenario: Add a file-level comment
    When I click "Add file comment" on the "src/auth/login.ts" file section header
    Then a comment input box should appear at the top of the file section
    When I type "This file needs refactoring" in the comment input
    And I click "Comment"
    Then a file-level comment should be displayed at the top of the "src/auth/login.ts" section
    And the comment should show "This file needs refactoring"

  # --- Categories ---

  Scenario: Add a comment with a category
    When I click the "+" icon on new line 5 in "src/auth/login.ts"
    And I select category "bug" in the comment input
    And I type "Null reference possible here" in the comment input
    And I click "Comment"
    Then the displayed comment should show a "bug" category badge

  # --- Edit and Delete ---

  Scenario: Edit an existing comment
    Given I have added a comment "Original text" on new line 5 of "src/auth/login.ts"
    When I click "Edit" on that comment
    Then the comment should become an editable input pre-filled with "Original text"
    When I replace the text with "Updated text"
    And I click "Comment"
    Then the comment should show "Updated text"

  Scenario: Delete a comment
    Given I have added a comment "Delete me" on new line 5 of "src/auth/login.ts"
    When I click "Delete" on that comment
    Then the comment should be removed
    And the file tree entry for "src/auth/login.ts" should show comment count 0

  # --- Cancel ---

  Scenario: Cancel adding a comment
    When I click the "+" icon on new line 5 in "src/auth/login.ts"
    And I type "Nevermind" in the comment input
    And I click "Cancel"
    Then no comment should be displayed below new line 5

  # --- Markdown Rendering ---

  Scenario: Comment body renders markdown
    When I click the "+" icon on new line 5 in "src/auth/login.ts"
    And I type "**bold** and *italic* text" in the comment input
    And I click "Comment"
    Then the comment body should render "bold" as bold text
    And "italic" as italic text

  # --- Comment on Deleted Lines ---

  Scenario: Comment on a deleted line
    When I click the "+" icon on old line 8 in "src/auth/login.ts"
    Then a comment input box should appear below that line
    When I type "Why was this removed?" in the comment input
    And I click "Comment"
    Then a comment should be displayed below old line 8 of "src/auth/login.ts"
