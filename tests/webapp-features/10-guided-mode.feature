Feature: Guided Walkthrough Mode
  As a developer reviewing AI-generated code with a walkthrough guide
  I want the file tree grouped and ordered by the guide with an overview panel
  So that I can review the change in the author's intended reading order

  # No Background: the regression-guard scenario must load WITHOUT a guide,
  # so each scenario declares its own Given.
  #
  # Stale-path coverage note: the harness's guide seam carries the same
  # display-ready payload the Electron main process sends over `guide:load`,
  # i.e. groups already reconciled against the diff. A guide entry pointing
  # at a nonexistent path is dropped during that main-process reconciliation,
  # which is covered by unit tests in packages/core/src/guide-parser.test.ts
  # ("drops guide entries whose path is not in the diff, and drops groups
  # left empty") and defensively in packages/react/src/utils/
  # guide-display.test.ts. Faking a pre-reconciliation payload here would
  # test a state production never renders, so that case is intentionally
  # not duplicated at this tier.

  Scenario: Group headers render in guide order with their rationales
    Given the webapp is loaded with fixture data and a walkthrough guide
    Then the file tree should show guide groups in this order:
      | group           | rationale                                       |
      | Core change     | The new module and the call site that adopts it |
      | Configuration   | Settings that gate the new behavior             |
      | Everything else |                                                 |

  Scenario: Files render within groups in guide order and unmentioned files land under "Everything else"
    Given the webapp is loaded with fixture data and a walkthrough guide
    Then the file tree should list files in this order:
      | file                 |
      | src/new-feature.ts   |
      | src/auth/login.ts    |
      | src/config.ts        |
      | README.md            |
      | src/legacy.ts        |
      | docs/architecture.md |
    And "src/new-feature.ts" should appear under guide group "Core change"
    And "src/auth/login.ts" should appear under guide group "Core change"
    And "src/config.ts" should appear under guide group "Configuration"
    And "README.md" should appear under guide group "Everything else"
    And "docs/architecture.md" should appear under guide group "Everything else"
    And the file tree entry for "src/new-feature.ts" should show guide description "adds the feature flags everything else reads"
    And the file section for "src/auth/login.ts" should show guide description "rewrites login flow with sessions and logging"

  Scenario: Overview panel renders above the first file section with a Mermaid diagram
    Given the webapp is loaded with fixture data and a walkthrough guide
    Then the guide overview panel should be visible above the first file section
    And the guide overview should render a Mermaid diagram as SVG

  Scenario: Toggling to Flat restores the ungrouped diff-order tree and back
    Given the webapp is loaded with fixture data and a walkthrough guide
    When I switch the guide mode to "Flat"
    Then the file tree should show no guide groups
    And the guide overview panel should not be visible
    And the file tree should list files in this order:
      | file                 |
      | README.md            |
      | src/auth/login.ts    |
      | src/config.ts        |
      | src/legacy.ts        |
      | docs/architecture.md |
      | src/new-feature.ts   |
    When I switch the guide mode to "Guided"
    Then the guide overview panel should be visible above the first file section
    And the file tree should list files in this order:
      | file                 |
      | src/new-feature.ts   |
      | src/auth/login.ts    |
      | src/config.ts        |
      | README.md            |
      | src/legacy.ts        |
      | docs/architecture.md |

  Scenario: Without a guide there is no toggle, no overview, and the tree is unchanged
    Given the webapp is loaded with fixture data
    Then the guide mode toggle should not be present
    And the guide overview panel should not be visible
    And the file tree should show no guide groups
    And the file tree should list files in this order:
      | file                 |
      | README.md            |
      | src/auth/login.ts    |
      | src/config.ts        |
      | src/legacy.ts        |
      | docs/architecture.md |
      | src/new-feature.ts   |

  Scenario: Marking viewed and commenting still work inside Guided mode
    Given the webapp is loaded with fixture data and a walkthrough guide
    When I check the "Viewed" checkbox on the "src/new-feature.ts" file section header
    Then the "Viewed" checkbox for "src/new-feature.ts" should be checked
    When I click the "+" icon on new line 5 in "src/auth/login.ts"
    And I type "Guided mode comment" in the comment input
    And I click "Comment"
    Then the comment should show "Guided mode comment"
    And the file tree entry for "src/auth/login.ts" should show comment count 1
