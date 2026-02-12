---
id: 6
group: 'documentation'
dependencies: [1, 2, 3, 4, 5]
status: 'completed'
created: '2026-02-11'
skills:
  - technical-writing
---

# Update PRD and Create BDD Feature Files

## Objective

Update PRD.md sections 5.4.1 (Line Comments) and 5.4.2 (Multi-Line Comments) to reflect the new
commenting behavior. Create BDD feature files in `test/features/` describing the new commenting UX.

## Skills Required

- `technical-writing`: PRD updates, BDD/Gherkin feature file creation

## Acceptance Criteria

- [ ] PRD section 5.4.1 describes the new icon-based activation (hover "+" icon in gutter, replaces
      line-number click)
- [ ] PRD section 5.4.2 describes the unified drag-based interaction model (click = single-line,
      drag = multi-line), hunk boundary constraints, and visual feedback
- [ ] PRD sections mention line range headers in both comment input and rendered comments
- [ ] PRD sections mention GFM markdown rendering for comment bodies
- [ ] PRD sections mention post-save behavior (input closes after saving)
- [ ] References to "clicking on a line number" are removed from the PRD
- [ ] BDD feature files are created in `test/features/` covering: icon visibility on hover,
      single-line comment via click, multi-line comment via drag, hunk boundary constraints, line
      range headers, markdown rendering, comment input closing after save
- [ ] Feature files use Gherkin syntax (Given/When/Then)

## Technical Requirements

- Modify `docs/PRD.md` (sections 5.4.1 and 5.4.2)
- Create `test/features/commenting.feature` (or split into multiple feature files)
- The `test/features/` directory may need to be created

## Input Dependencies

- Tasks 1-5: All implementation tasks should be complete so documentation accurately reflects the
  final behavior

## Output Artifacts

- Updated `docs/PRD.md`
- New `test/features/commenting.feature` (or equivalent)

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### PRD Section 5.4.1 — Line Comments (replace content at lines 273-278)

Replace the current content with something like:

```markdown
#### 5.4.1 Line Comments

- **Activation:** Hovering over a code line reveals a "+" icon in the line number gutter. Clicking
  the icon opens a comment input box below that line. The line number text itself is not
  interactive.
- **Input:** A text area for writing comments in GitHub-flavored markdown (GFM). The input shows a
  header indicating the target line (e.g., "Comment on line 13").
- **Actions:** "Comment" button to submit. "Cancel" to discard.
- **Post-save behavior:** After saving, the comment input closes. To add another comment, click the
  "+" icon again.
- **Display:** Submitted comments appear inline below the line they reference, with a line range
  header, category badge, and the comment body rendered as GitHub-flavored markdown (bold, italic,
  code blocks, tables, task lists, strikethrough).
```

### PRD Section 5.4.2 — Multi-Line Comments (replace content at lines 280-283)

```markdown
#### 5.4.2 Multi-Line Comments

- **Activation:** Click and drag the "+" gutter icon across multiple lines to select a range. The
  drag interaction provides real-time visual feedback by highlighting the selected lines.
- **Unified code path:** Single-line and multi-line comments share one interaction model. Clicking
  the icon is a degenerate case of dragging (start line equals end line).
- **Hunk boundary constraint:** Drag selection cannot span across hunk boundaries (@@ separators).
  The selection is clamped to lines within the same hunk.
- **Side constraint (split view):** In split view, drag is locked to the side (old/new) where it
  started.
- **Display:** The selected line range is visually highlighted, and the comment appears below the
  last line of the range with a header indicating the range (e.g., "Comment on lines 6 to 10").
```

### BDD Feature File — `test/features/commenting.feature`

Create the directory if it doesn't exist: `mkdir -p test/features`

```gherkin
Feature: Comment Activation via Gutter Icon

  Scenario: Plus icon appears on hover
    Given a diff is loaded with code lines
    When the user hovers over a code line's gutter
    Then a "+" icon appears in the gutter

  Scenario: Plus icon is hidden by default
    Given a diff is loaded with code lines
    Then no "+" icons are visible in the gutter

  Scenario: Single-line comment via icon click
    Given a diff is loaded with code lines
    When the user clicks the "+" icon on line 5
    Then a comment input appears below line 5
    And the comment input header shows "Comment on line 5"

  Scenario: Comment input closes after saving
    Given a comment input is open on line 5
    When the user types a comment and clicks "Comment"
    Then the comment is saved and displayed inline
    And the comment input is closed

Feature: Multi-Line Comment via Drag

  Scenario: Drag to select multiple lines
    Given a diff is loaded with a hunk containing lines 1-20
    When the user mousedowns on the "+" icon at line 5
    And drags to line 10
    Then lines 5 through 10 are highlighted
    When the user releases the mouse
    Then a comment input appears below line 10
    And the comment input header shows "Comment on lines 5 to 10"

  Scenario: Drag is constrained to hunk boundaries
    Given a diff with hunk A (lines 1-15) and hunk B (lines 20-30)
    When the user starts dragging from line 10 in hunk A
    And drags past line 15 toward hunk B
    Then the selection is clamped to line 15

  Scenario: Drag upward works correctly
    Given a diff is loaded with code lines
    When the user mousedowns on the "+" icon at line 10
    And drags upward to line 5
    Then lines 5 through 10 are highlighted

Feature: Line Range Headers

  Scenario: Single-line comment shows line header
    Given a saved comment on line 13
    Then the comment display shows "line 13" in the header

  Scenario: Multi-line comment shows range header
    Given a saved comment on lines 6 to 10
    Then the comment display shows "lines 6–10" in the header

  Scenario: File-level comment shows no line header
    Given a saved file-level comment
    Then the comment display shows no line range header

Feature: Markdown Rendering in Comments

  Scenario: Bold and italic text render correctly
    Given a saved comment with body "**bold** and *italic*"
    Then the comment body renders "bold" as bold text
    And "italic" as italic text

  Scenario: Code blocks render correctly
    Given a saved comment with a fenced code block
    Then the code block renders with monospace font and background

  Scenario: GFM tables render correctly
    Given a saved comment with a GFM table
    Then the table renders with borders and alignment
```

Adapt the scenarios to match the exact final behavior. The feature file serves as a specification,
not an automated test suite (unless E2E testing is set up).

</details>
