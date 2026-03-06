Feature: Rendered Markdown View
  As a developer using the @self-review/react library
  I want to view new markdown files in rendered format
  So that I can review formatted content more naturally

  Background:
    Given the webapp is loaded with markdown fixture data

  Scenario: New markdown file shows rendered toggle
    Then I should see a "Rendered" toggle in the file header for "docs/new-docs.md"

  Scenario: Non-markdown file does not show rendered toggle
    Then I should not see a "Rendered" toggle in the file header for "src/index.ts"

  Scenario: Modified markdown file does not show rendered toggle
    Then I should not see a "Rendered" toggle in the file header for "README.md"

  Scenario: Toggle switches to rendered view
    When I click the "Rendered" toggle for "docs/new-docs.md"
    Then I should see the markdown rendered as formatted HTML
    And I should see a gutter with line ranges

  Scenario: Gutter shows collapsed line ranges for rendered blocks
    When I click the "Rendered" toggle for "docs/new-docs.md"
    Then the gutter should show collapsed line ranges like "3-4"

  Scenario: Comment on rendered block via gutter
    When I click the "Rendered" toggle for "docs/new-docs.md"
    And I click on the gutter for a paragraph block
    Then the comment input should open with the correct line range

  Scenario: Comments placed in rendered view appear in raw view
    When I click the "Rendered" toggle for "docs/new-docs.md"
    And I add a comment on the paragraph block
    And I click the "Raw" toggle for "docs/new-docs.md"
    Then the comment should appear at the same source lines in the raw view

  Scenario: Mermaid code blocks render as SVG diagrams
    When I click the "Rendered" toggle for "docs/new-docs.md"
    Then the mermaid code block should render as an SVG diagram
