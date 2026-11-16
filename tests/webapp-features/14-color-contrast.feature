Feature: Webapp color contrast
  As a reviewer with low vision
  I want every piece of text to meet WCAG 2 AA contrast
  So that I can read the review in either theme

  # axe judges only text that is on screen, so the check first makes the
  # viewport as tall as the page.

  Scenario Outline: Review surfaces in the <theme> theme and <view> view
    Given the webapp is loaded for a contrast check with "<query>"
    And I have added a comment with a suggestion on new line 5 of "src/auth/login.ts"
    When I add a "question" comment on new line 3 of "src/auth/login.ts"
    And I open a comment draft on new line 7 of "src/auth/login.ts"
    Then all text should meet WCAG AA contrast

    Examples:
      | theme | view    | query                                                       |
      | light | split   | theme=light&view=split&categories=commenting&apply=refused  |
      | dark  | split   | theme=dark&view=split&categories=commenting&apply=refused   |
      | light | unified | theme=light&view=unified&categories=commenting&apply=applied |
      | dark  | unified | theme=dark&view=unified&categories=commenting&apply=applied  |

  Scenario Outline: <surface> in the <theme> theme
    Given the webapp is loaded for a contrast check with "<query>"
    Then all text should meet WCAG AA contrast

    Examples:
      | surface          | theme | query                                |
      | Guided mode      | light | theme=light&guide=walkthrough        |
      | Guided mode      | dark  | theme=dark&guide=walkthrough         |
      | Markdown files   | light | theme=light&fixture=markdown         |
      | Markdown files   | dark  | theme=dark&fixture=markdown          |
      | Rendered HTML    | light | theme=light&fixture=rendered-html    |
      | Rendered HTML    | dark  | theme=dark&fixture=rendered-html     |
      | Empty diff help  | light | theme=light&fixture=empty            |
      | Empty diff help  | dark  | theme=dark&fixture=empty             |
