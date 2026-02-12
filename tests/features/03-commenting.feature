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

  # --- Icon-Based Comment Activation ---

  Scenario: Plus icon appears on hover
    When I hover over the gutter of new line 5 in "src/auth/login.ts"
    Then a "+" icon should be visible in the gutter

  Scenario: Plus icon is hidden by default
    Then no "+" icons should be visible in the gutter area

  Scenario: No icon on empty padding cells in split view
    Given I am viewing diffs in split mode
    When I hover over an empty padding cell in the gutter
    Then no "+" icon should appear

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

  Scenario: Comment input closes after saving
    When I click the "+" icon on new line 5 in "src/auth/login.ts"
    And I type "A comment" in the comment input
    And I click "Comment"
    Then the comment input should be closed
    And no empty comment input should be visible

  # --- Multi-Line Comment via Drag ---

  Scenario: Drag to select multiple lines for a comment
    When I mousedown on the "+" icon at new line 10 in "src/auth/login.ts"
    And I drag to new line 15
    Then lines 10 through 15 should be visually highlighted
    When I release the mouse
    Then a comment input box should appear below new line 15
    And the comment input header should show "Comment on lines 10 to 15"

  Scenario: Drag upward works correctly
    When I mousedown on the "+" icon at new line 15 in "src/auth/login.ts"
    And I drag upward to new line 10
    Then lines 10 through 15 should be visually highlighted

  Scenario: Drag is constrained to hunk boundaries
    Given a diff with hunk A covering new lines 1-15 and hunk B covering new lines 20-30 in "src/config.ts"
    When I mousedown on the "+" icon at new line 10
    And I drag past new line 15 toward hunk B
    Then the selection should be clamped to new line 15

  Scenario: Add a multi-line comment
    When I mousedown on the "+" icon at new line 10 in "src/auth/login.ts"
    And I drag to new line 15
    And I release the mouse
    And I type "This whole block needs error handling" in the comment input
    And I click "Comment"
    Then a comment should be displayed below new line 15
    And the comment header should show "lines 10–15"

  # --- Line Range Headers ---

  Scenario: Single-line comment shows line header in display
    Given I have added a comment on new line 13 of "src/auth/login.ts"
    Then the comment display header should show "line 13"

  Scenario: Multi-line comment shows range header in display
    Given I have added a comment on new lines 6 to 10 of "src/auth/login.ts"
    Then the comment display header should show "lines 6–10"

  Scenario: File-level comment shows no line header
    Given I have added a file-level comment on "src/auth/login.ts"
    Then the comment display should show no line range indicator

  # --- Markdown Rendering ---

  Scenario: Comment body renders markdown
    When I click the "+" icon on new line 5 in "src/auth/login.ts"
    And I type "**bold** and *italic* text" in the comment input
    And I click "Comment"
    Then the comment body should render "bold" as bold text
    And "italic" as italic text

  Scenario: Comment body renders GFM code blocks
    When I click the "+" icon on new line 5 in "src/auth/login.ts"
    And I type a comment with a fenced code block
    And I click "Comment"
    Then the code block should render with monospace font and a background

  Scenario: Comment body renders GFM tables
    When I click the "+" icon on new line 5 in "src/auth/login.ts"
    And I type a comment with a GFM table
    And I click "Comment"
    Then the table should render with borders

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

  # --- Comment on Deleted Lines ---

  Scenario: Comment on a deleted line
    When I click the "+" icon on old line 8 in "src/auth/login.ts"
    Then a comment input box should appear below that line
    When I type "Why was this removed?" in the comment input
    And I click "Comment"
    Then a comment should be displayed below old line 8 of "src/auth/login.ts"
