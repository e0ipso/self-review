Feature: Rendered Markdown View
  As a reviewer
  I want to view new markdown files in rendered format
  So that I can review formatted content more naturally

  Scenario: New markdown file shows rendered toggle
    Given a git repository with a new markdown file "README.md" containing:
      """
      # Hello World

      Some content here.
      """
    And I launch self-review
    Then I should see a "Rendered" toggle in the file header for "README.md"

  Scenario: Non-markdown file does not show rendered toggle
    Given a git repository with a new file "src/index.ts" containing:
      """
      export const main = () => console.log('hello');
      """
    And I launch self-review
    Then I should not see a "Rendered" toggle in the file header for "src/index.ts"

  Scenario: Modified markdown file does not show rendered toggle
    Given a git repository with changes to the following files:
      | file       | change_type | additions | deletions |
      | README.md  | modified    | 5         | 2         |
    And I launch self-review
    Then I should not see a "Rendered" toggle in the file header for "README.md"

  Scenario: Toggle switches to rendered view
    Given a git repository with a new markdown file "README.md" containing:
      """
      # Hello World

      Some content here.
      """
    And I launch self-review
    When I click the "Rendered" toggle for "README.md"
    Then I should see the markdown rendered as formatted HTML
    And I should see a gutter with line ranges

  Scenario: Gutter shows collapsed line ranges for rendered blocks
    Given a git repository with a new markdown file "README.md" containing:
      """
      # Heading

      A paragraph that spans
      multiple lines in the source.

      - List item one
      - List item two
      """
    And I launch self-review
    When I click the "Rendered" toggle for "README.md"
    Then the gutter should show collapsed line ranges like "3-4"

  Scenario: Comment on rendered block via gutter
    Given a git repository with a new markdown file "README.md" containing:
      """
      # Heading

      A paragraph of text.
      """
    And I launch self-review
    And I click the "Rendered" toggle for "README.md"
    When I click on the gutter for a paragraph block
    Then the comment input should open with the correct line range

  Scenario: Comments placed in rendered view appear in raw view
    Given a git repository with a new markdown file "README.md" containing:
      """
      # Heading

      A paragraph of text.
      """
    And I launch self-review
    And I click the "Rendered" toggle for "README.md"
    When I add a comment on the paragraph block
    And I click the "Raw" toggle for "README.md"
    Then the comment should appear at the same source lines in the raw view

  Scenario: Mermaid code blocks render as SVG diagrams
    Given a git repository with a new markdown file "README.md" containing:
      """
      # Architecture

      ```mermaid
      graph TD
          A[Start] --> B[End]
      ```
      """
    And I launch self-review
    When I click the "Rendered" toggle for "README.md"
    Then the mermaid code block should render as an SVG diagram
