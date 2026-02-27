Feature: Find in Page
  As a developer reviewing code
  I want to search for text across all files in the diff
  So that I can quickly locate specific code patterns or keywords

  Background:
    Given a git repository with a file "src/example.ts" containing:
      """
      function authenticate(user) {
        const token = generateToken(user);
        if (!token) throw new Error("auth failed");
        return token;
      }
      """
    And I launch self-review
    And the file tree should list 1 file

  Scenario: Opening find bar with Ctrl+F
    When I press "Ctrl+F"
    Then the find bar should be visible
    And the find input should be focused

  Scenario: Searching for text highlights matches
    When I press "Ctrl+F"
    And I type "token" in the find bar
    And I press "Enter"
    Then the match counter should show "1 of 5"
    And the first match should be highlighted

  Scenario: Cycling through matches with Enter
    When I press "Ctrl+F"
    And I type "token" in the find bar
    And I press "Enter"
    Then the match counter should show "1 of 5"
    And I press "Enter"
    Then the match counter should show "2 of 5"
    And I press "Enter"
    Then the match counter should show "3 of 5"

  Scenario: Searching for multi-character queries
    When I press "Ctrl+F"
    And I type "authenticate" in the find bar
    And I press "Enter"
    Then the match counter should show "1 of 2"

  Scenario: Closing find bar with Escape
    When I press "Ctrl+F"
    And I type "token" in the find bar
    And I press "Escape"
    Then the find bar should not be visible
