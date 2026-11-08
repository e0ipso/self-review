Feature: Reviewed content isolation
  As a developer reviewing untrusted content
  I want Mermaid diagrams and raw HTML in reviewed files to stay inside their preview
  So that reviewed content can never style, cover or disable the review controls

  Background:
    Given the webapp is loaded with hostile content fixture data

  Scenario: Mermaid CSS and HTML payloads render as isolated images
    When I click the "Rendered" toggle for "docs/hostile.md"
    Then every Mermaid block should settle as an isolated image or a contained error
    And no diagram markup or stylesheet should exist in the application document
    And the review controls should stay visible and clickable
    And I save a screenshot named "task-12-mermaid-isolation.png"

  Scenario: Raw HTML in Markdown loses positioning classes and inline styles
    When I click the "Rendered" toggle for "docs/hostile.md"
    Then the rendered element containing "RAW HTML OVERLAY" should carry no class or style attribute
    And the review controls should stay visible and clickable

  Scenario: An HTML file loses positioning classes and inline styles
    When I click the "Rendered" toggle for "docs/hostile.html"
    Then the rendered element containing "HTML FILE OVERLAY" should carry no class or style attribute
    And the review controls should stay visible and clickable
    And I save a screenshot named "task-12-passive-html-containment.png"
