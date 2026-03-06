Feature: Webapp File Viewed Status
  As a developer using the ReviewPanel component
  I want to mark files as viewed
  So that the viewed status tracking works in the standalone library

  Background:
    Given the webapp is loaded with fixture data

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
