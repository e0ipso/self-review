Feature: Welcome Screen and Directory Mode
  As a developer reviewing AI-generated code outside a git repository
  I want a welcome screen that lets me pick a directory to review
  So that I can review generated code without needing a git repo

  Scenario: Welcome screen appears when launched outside git repo
    Given I am in a directory that is not a git repository
    When I launch self-review
    Then the welcome screen should be visible
    And the welcome screen should show the app title "self-review"
    And the welcome screen should describe directory mode

  Scenario: Directory mode loads all files as additions
    Given a temporary directory with the following files:
      | file          | content               |
      | src/index.ts  | console.log("hello"); |
      | src/utils.ts  | export const x = 1;   |
      | README.md     | # Hello               |
    When I launch self-review with the directory path
    Then the file tree should list 3 files
    And the file tree entry for "README.md" should show change type "added"
    And the file tree entry for "src/index.ts" should show change type "added"
    And the file tree entry for "src/utils.ts" should show change type "added"

  Scenario: Toolbar shows directory path in directory mode
    Given a temporary directory with the following files:
      | file         | content             |
      | src/index.ts | console.log("hi");  |
    When I launch self-review with the directory path
    Then the toolbar should contain the directory path

  Scenario: Finish Review produces valid XML with source-path and no git-diff-args
    Given a temporary directory with the following files:
      | file         | content             |
      | src/index.ts | console.log("hi");  |
    When I launch self-review with the directory path
    And I click "Finish Review"
    Then the output file should contain valid XML
    And the XML should contain a "source-path" attribute
    And the XML should not contain a "git-diff-args" attribute
    And the XML should not contain a "repository" attribute
    And the process should exit with code 0

  Scenario: Launching with non-git directory path arg skips welcome screen
    Given a temporary directory with the following files:
      | file       | content   |
      | hello.txt  | Hello!    |
    When I launch self-review with the directory path
    Then the welcome screen should not be visible
    And the file tree should list 1 file

  Scenario: Binary files in directory mode show indicator
    Given a temporary directory with a binary file "image.png"
    When I launch self-review with the directory path
    Then the file section for "image.png" should show a binary file indicator
