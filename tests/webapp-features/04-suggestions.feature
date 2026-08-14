Feature: Webapp Code Suggestions
  As a developer using the ReviewPanel component
  I want to add code suggestions to comments
  So that the suggestion system works in the standalone library

  Background:
    Given the webapp is loaded with fixture data

  Scenario: Add a suggestion and see the suggestion block
    When I click the "+" icon on new line 5 in "src/auth/login.ts"
    And I type "Suggestion comment" in the comment input
    And I click "Add suggestion"
    Then a suggestion editor should appear with original code pre-filled from new line 5
    When I type "const fixed = true;" in the proposed code editor
    And I click "Comment"
    Then the displayed comment should show a suggestion block

  Scenario: Editing a comment with a suggestion shows the saved proposed code, not the original
    When I click the "+" icon on new line 5 in "src/auth/login.ts"
    And I type "Suggestion comment" in the comment input
    And I click "Add suggestion"
    And I type "const fixed = true;" in the proposed code editor
    And I click "Comment"
    Then the displayed comment should show a suggestion block
    When I click "Edit" on that comment
    Then the proposed code editor should contain "const fixed = true;"
