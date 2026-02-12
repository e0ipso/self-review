Feature: Error Handling
  As a developer using self-review
  I want clear error messages when something goes wrong
  So that I can diagnose and fix the problem

  Scenario: Not a git repository
    Given I am in a directory that is not a git repository
    When I launch self-review
    Then the process should exit with code 1
    And stderr should contain an error message about not being a git repository

  Scenario: Invalid git ref
    Given a git repository with no commits
    When I launch self-review with "main..nonexistent-branch"
    Then the process should exit with code 1
    And stderr should contain an error message from git

  Scenario: Empty diff produces valid output
    Given a git repository with no changes
    When I launch self-review
    And I click "Finish Review"
    Then the output file should contain valid XML
    And the XML should contain 0 file elements
    And the process should exit with code 0

  Scenario: --help prints usage and exits
    When I launch self-review with "--help"
    Then stderr should contain usage information
    And the process should exit with code 0

  Scenario: --version prints version and exits
    When I launch self-review with "--version"
    Then stderr should contain a version string
    And the process should exit with code 0
