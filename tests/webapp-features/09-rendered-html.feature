Feature: Rendered HTML View
  As a developer using the @self-review/react library
  I want to review new HTML files in rendered format
  So that rendered HTML supports the same comment workflow as rendered Markdown

  Background:
    Given the webapp is loaded with rendered HTML fixture data

  Scenario: Added HTML file shows rendered content with commentable gutters
    Then I should see a "Rendered" toggle in the file header for "docs/page.html"
    When I click the "Rendered" toggle for "docs/page.html"
    Then I should see the HTML rendered as formatted content
    And the gutter should show collapsed line ranges like "7-10"

  Scenario: Rendered HTML comments save expected new-line ranges
    When I click the "Rendered" toggle for "docs/page.html"
    And I add rendered comment "Review intro copy" on the block containing "Intro paragraph for rendered review."
    And I add rendered comment "Review list grouping" on the block containing "First listed item"
    And I finish the webapp review
    Then the saved review should include comments for "docs/page.html":
      | body                 | side | start | end |
      | Review intro copy    | new  | 3     | 3   |
      | Review list grouping | new  | 7     | 10  |

  Scenario: Rendered Markdown commenting still uses the shared workflow
    When I click the "Rendered" toggle for "docs/new-docs.md"
    And I add a comment on the paragraph block
    And I click the "Raw" toggle for "docs/new-docs.md"
    Then the comment should appear at the same source lines in the raw view
