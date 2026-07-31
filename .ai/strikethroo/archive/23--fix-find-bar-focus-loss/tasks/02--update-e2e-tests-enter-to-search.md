---
id: 2
group: "findbar-fix"
dependencies: [1]
status: "completed"
created: "2026-02-27"
skills:
  - e2e-testing
---
# Update E2E Tests for Enter-to-Search Behavior

## Objective
Update the find-in-page e2e test scenarios to reflect the new Enter-to-search behavior. Three scenarios currently assume auto-search triggers on typing and need an explicit Enter press added after typing to trigger the search.

## Skills Required
- `e2e-testing`: Modifying Cucumber/Gherkin BDD scenarios for Playwright-based e2e tests

## Acceptance Criteria
- [ ] "Searching for text highlights matches" scenario passes with Enter-to-search
- [ ] "Searching for multi-character queries" scenario passes with Enter-to-search
- [ ] "Cycling through matches with Enter" scenario passes with corrected match counter values
- [ ] All 5 scenarios in `14-find-in-page.feature` pass

Use your internal Todo tool to track these and keep on track.

### Meaningful Test Strategy Guidelines

**IMPORTANT**: These are e2e tests for a critical user workflow (find-in-page). They verify the actual behavior change introduced by Task 1. These tests are meaningful because they validate:
- Custom business logic (Enter-to-search vs auto-search)
- Critical user workflows (finding text in the diff viewer)
- Integration between renderer and Chromium's findInPage API

## Technical Requirements
- Cucumber/Gherkin `.feature` file syntax
- Existing step definitions for `I press "Enter"` and `I type "..." in the find bar`

## Input Dependencies
- Task 1 must be completed (FindBar component changes)

## Output Artifacts
- Modified `tests/features/14-find-in-page.feature`

## Implementation Notes

<details>
<summary>Detailed implementation instructions</summary>

### File to modify: `tests/features/14-find-in-page.feature`

### Scenario 1: "Searching for text highlights matches" (lines 23-27)

Current:
```gherkin
  Scenario: Searching for text highlights matches
    When I press "Ctrl+F"
    And I type "token" in the find bar
    Then the match counter should show "1 of 5"
    And the first match should be highlighted
```

Updated — add `And I press "Enter"` after typing:
```gherkin
  Scenario: Searching for text highlights matches
    When I press "Ctrl+F"
    And I type "token" in the find bar
    And I press "Enter"
    Then the match counter should show "1 of 5"
    And the first match should be highlighted
```

### Scenario 2: "Cycling through matches with Enter" (lines 29-37)

Current:
```gherkin
  Scenario: Cycling through matches with Enter
    When I press "Ctrl+F"
    And I type "token" in the find bar
    And I press "Enter"
    Then the match counter should show "2 of 5"
    And I press "Enter"
    Then the match counter should show "3 of 5"
    And I press "Enter"
    Then the match counter should show "4 of 5"
```

Updated — add an initial Enter to trigger the search, and adjust the first match counter from `"2 of 5"` to `"1 of 5"` (the first Enter now triggers the search instead of cycling):
```gherkin
  Scenario: Cycling through matches with Enter
    When I press "Ctrl+F"
    And I type "token" in the find bar
    And I press "Enter"
    Then the match counter should show "1 of 5"
    And I press "Enter"
    Then the match counter should show "2 of 5"
    And I press "Enter"
    Then the match counter should show "3 of 5"
```

**Important**: The old scenario assumed auto-search already found match 1, so the first Enter moved to match 2. Now the first Enter triggers the search (landing on match 1), and subsequent Enters cycle. The counter values shift down by 1 accordingly. The total number of Enter presses and assertions should be adjusted so the scenario still tests cycling.

### Scenario 3: "Searching for multi-character queries" (lines 39-42)

Current:
```gherkin
  Scenario: Searching for multi-character queries
    When I press "Ctrl+F"
    And I type "authenticate" in the find bar
    Then the match counter should show "1 of 2"
```

Updated — add `And I press "Enter"` after typing:
```gherkin
  Scenario: Searching for multi-character queries
    When I press "Ctrl+F"
    And I type "authenticate" in the find bar
    And I press "Enter"
    Then the match counter should show "1 of 2"
```

### Scenarios NOT to change
- **"Opening find bar with Ctrl+F"** (lines 18-21) — does not involve searching
- **"Closing find bar with Escape"** (lines 44-48) — the `I type` + `I press "Escape"` flow does not depend on auto-search

</details>
