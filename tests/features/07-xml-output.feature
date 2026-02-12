Feature: XML Output
  As a developer using self-review with an AI agent
  I want the XML output to be valid and complete
  So that my AI agent can parse and act on my review feedback

  Background:
    Given a git repository with changes to the following files:
      | file              | change_type | additions | deletions |
      | src/auth/login.ts | modified    | 10        | 3         |
      | src/config.ts     | modified    | 25        | 0         |
    And the project has these comment categories:
      | name     | color   |
      | bug      | #e53e3e |
      | nit      | #718096 |

  Scenario: Empty review produces valid XML with all files
    When I launch self-review
    And the file tree should list 5 files
    And I close the Electron window
    Then stdout should contain valid XML
    And the XML should have a root element "review" with namespace "urn:self-review:v1"
    And the XML should contain 5 file elements
    And the XML "review" element should have a "timestamp" attribute
    And the XML "review" element should have a "git-diff-args" attribute
    And the XML "review" element should have a "repository" attribute

  Scenario: XML contains comments with correct line references
    When I launch self-review
    And I add a comment "Fix this" on new line 5 of "src/auth/login.ts"
    And I close the Electron window
    Then the XML file element for "src/auth/login.ts" should contain 1 comment
    And that comment should have new-line-start="5" and new-line-end="5"
    And that comment should have body "Fix this"

  Scenario: XML contains file-level comments without line attributes
    When I launch self-review
    And I add a file-level comment "Needs refactor" on "src/auth/login.ts"
    And I close the Electron window
    Then the XML file element for "src/auth/login.ts" should contain 1 comment
    And that comment should not have line attributes

  Scenario: XML contains comments with categories
    When I launch self-review
    And I add a comment "Null ref" with category "bug" on new line 5 of "src/auth/login.ts"
    And I close the Electron window
    Then that comment should have a category element with text "bug"

  Scenario: XML contains suggestions with original and proposed code
    When I launch self-review
    And I add a comment with a suggestion on new lines 5-7 of "src/auth/login.ts"
    And I close the Electron window
    Then that comment should have a suggestion element
    And the suggestion should have an "original-code" element
    And the suggestion should have a "proposed-code" element

  Scenario: XML contains multi-line comment with correct range
    When I launch self-review
    And I add a comment "Refactor this block" on new lines 10-15 of "src/auth/login.ts"
    And I close the Electron window
    Then that comment should have new-line-start="10" and new-line-end="15"

  Scenario: XML contains comment on deleted line with old line references
    When I launch self-review
    And I add a comment "Why removed?" on old line 8 of "src/auth/login.ts"
    And I close the Electron window
    Then that comment should have old-line-start="8" and old-line-end="8"
    And that comment should not have new-line-start or new-line-end attributes

  Scenario: XML validates against the XSD schema
    When I launch self-review
    And I add a comment "Test" on new line 5 of "src/auth/login.ts"
    And I close the Electron window
    Then the XML output should validate against "docs/self-review-v1.xsd"

  Scenario: Nothing is written to stdout except XML
    When I launch self-review
    And I close the Electron window
    Then stdout should start with "<?xml"
    And stderr should not be empty
