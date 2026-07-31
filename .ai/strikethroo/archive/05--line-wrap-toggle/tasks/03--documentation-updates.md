---
id: 3
group: 'line-wrap-docs'
dependencies: []
status: 'completed'
created: '2026-02-12'
skills:
  - documentation
---

# Update PRD, README, and Feature Tests for Line Wrap Toggle

## Objective

Update all documentation and BDD feature files to reflect the new line wrap toggle feature:
PRD Section 5.5 (toolbar table), PRD Sections 7.3/7.4 (config examples), README available options
list, and `05-view-modes-and-toolbar.feature` test scenarios.

## Skills Required

- Documentation (Markdown editing, BDD Gherkin syntax)

## Acceptance Criteria

- [ ] `docs/PRD.md` Section 5.5 toolbar table has a new row for the line wrap toggle
- [ ] `docs/PRD.md` Section 7.3 user-level config example includes `word-wrap: true`
- [ ] `docs/PRD.md` Section 7.4 project-level config example includes `word-wrap: true`
- [ ] `README.md` available options list includes `word-wrap` with description and default
- [ ] `tests/features/05-view-modes-and-toolbar.feature` has scenarios for toggling line wrap on/off
- [ ] All documentation is consistent in terminology and formatting

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Toolbar table row: control = "Line wrap toggle", type = "Toggle button", description mentions
  wrapping long lines with default on
- YAML config key is `word-wrap` (kebab-case), default `true`
- Feature scenarios should test toggling from default (wrap on) to scroll mode and back
- Button `data-testid` is `toggle-word-wrap-btn`

## Input Dependencies

None — documentation can be written based on the plan specification.

## Output Artifacts

- Updated `docs/PRD.md` with toolbar row and config examples
- Updated `README.md` with `word-wrap` option
- Updated `tests/features/05-view-modes-and-toolbar.feature` with line wrap scenarios

## Implementation Notes

<details>
<summary>Detailed implementation steps</summary>

### 1. `docs/PRD.md` Section 5.5 — Add toolbar row

In the toolbar table (after the "Show/hide untracked" row, before "Diff stats summary"), add:

```
| Line wrap toggle | Toggle button | Wrap or unwrap long lines in the code content area. When off, long lines scroll horizontally. Default: on. |
```

### 2. `docs/PRD.md` Section 7.3 — Add to user-level config example

After the `show-untracked: true` line in the user-level config YAML block, add:

```yaml
# Wrap long lines in the diff viewer: true or false
word-wrap: true
```

### 3. `docs/PRD.md` Section 7.4 — Add to project-level config example

After the `show-untracked: true` line in the project-level config YAML block, add:

```yaml
# Wrap long lines in the diff viewer: true or false
word-wrap: true
```

### 4. `README.md` — Add to available options list

After the `show-untracked` bullet in the "Available options" section, add:

```markdown
- `word-wrap`: wrap long lines in the diff viewer (default: true)
```

### 5. `tests/features/05-view-modes-and-toolbar.feature` — Add scenarios

Append two new scenarios at the end of the file:

```gherkin
  Scenario: Toggle line wrapping off
    Then long lines should be wrapped by default
    When I click the "No Wrap" toggle in the toolbar
    Then long lines should scroll horizontally
    And a horizontal scrollbar should be visible on overflowing lines

  Scenario: Toggle line wrapping back on
    When I click the "No Wrap" toggle in the toolbar
    And I click the "Wrap Lines" toggle in the toolbar
    Then long lines should be wrapped
    And no horizontal scrollbar should be visible
```

Note: The button label changes between states — "Wrap Lines" when wrapping is on (clicking turns it
off is shown as the current state label), "No Wrap" when wrapping is off. The scenario steps reference
the button by its label text at the time of clicking.

</details>
