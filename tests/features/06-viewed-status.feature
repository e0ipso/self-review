Feature: File Viewed Status
  As a developer reviewing code
  I want to mark files as viewed
  So that my AI agent knows which files I actually reviewed

  Background:
    Given a git repository with staged changes to the following files:
      | file              | change_type | additions | deletions |
      | src/auth/login.ts | modified    | 10        | 3         |
      | src/config.ts     | added       | 25        | 0         |
    And I launch self-review with "--staged"

  Scenario: Files start as not viewed
    Then the "Viewed" checkbox for "src/auth/login.ts" should be unchecked
    And the "Viewed" checkbox for "src/config.ts" should be unchecked

  Scenario: Mark a file as viewed via the file section header
    When I check the "Viewed" checkbox on the "src/auth/login.ts" file section header
    Then the "Viewed" checkbox for "src/auth/login.ts" should be checked

  Scenario: Unmark a file as viewed
    When I check the "Viewed" checkbox on the "src/auth/login.ts" file section header
    And I uncheck the "Viewed" checkbox on the "src/auth/login.ts" file section header
    Then the "Viewed" checkbox for "src/auth/login.ts" should be unchecked

  Scenario: Viewed status is reflected in XML output
    When I check the "Viewed" checkbox on the "src/auth/login.ts" file section header
    And I close the Electron window
    Then the XML output should contain a file element for "src/auth/login.ts" with viewed="true"
    And the XML output should contain a file element for "src/config.ts" with viewed="false"
