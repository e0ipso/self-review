Feature: Code Suggestions
  As a developer reviewing code
  I want to propose code replacements as suggestions
  So that my AI agent can apply them directly

  Background:
    Given a git repository with staged changes to the following files:
      | file              | change_type | additions | deletions |
      | src/auth/login.ts | modified    | 10        | 3         |
    And I launch self-review with "--staged"

  Scenario: Add a suggestion to a comment
    When I click the line number for new line 5 in "src/auth/login.ts"
    And I type "Rename this variable" in the comment input
    And I click "Add suggestion"
    Then a suggestion editor should appear with original code pre-filled from new line 5
    When I type "const isAuthenticated = true;" in the proposed code editor
    And I click "Add comment"
    Then the displayed comment should show a suggestion block
    And the suggestion block should show original code as deleted lines
    And the suggestion block should show proposed code as added lines

  Scenario: Add a multi-line suggestion
    When I select line numbers from new line 10 to new line 12 in "src/auth/login.ts"
    And I type "Wrap in try-catch" in the comment input
    And I click "Add suggestion"
    Then a suggestion editor should appear with original code pre-filled from new lines 10-12
    When I enter proposed code in the suggestion editor
    And I click "Add comment"
    Then the displayed comment should show a suggestion block

  Scenario: Suggestion renders with syntax highlighting
    Given I have added a comment with a suggestion on new line 5 of "src/auth/login.ts"
    Then the suggestion block should have syntax-highlighted code
