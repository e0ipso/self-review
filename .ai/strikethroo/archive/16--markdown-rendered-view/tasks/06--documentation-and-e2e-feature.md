---
id: 6
group: "rendered-markdown-view"
dependencies: [5]
status: "completed"
created: "2026-02-18"
skills: ["e2e-testing", "typescript"]
---

# Update Documentation and Add E2E Feature File

## Objective

Update project documentation (`AGENTS.md`, `docs/PRD.md`) to reflect the new rendered markdown view capability. Add an E2E feature file (`tests/features/12-rendered-markdown.feature`) with Cucumber scenarios covering the feature's key behaviors.

## Skills Required

Markdown documentation writing, Cucumber/Gherkin BDD scenario authoring, familiarity with the project's existing documentation and test structure.

## Acceptance Criteria

- [ ] `AGENTS.md` updated: `RenderedMarkdownView.tsx` added to the Project Structure section under `DiffViewer/`; `react-markdown`, `mermaid`, `@tailwindcss/typography` added to Tech Stack
- [ ] `docs/PRD.md` updated: Section 5.3.2 (Diff View Modes) describes the per-file rendered markdown toggle; Section 2 (Tech Stack) includes the new dependencies
- [ ] `tests/features/12-rendered-markdown.feature` exists with scenarios covering:
  - New markdown file shows "Rendered" toggle
  - Toggle switches to rendered view showing formatted markdown
  - Gutter shows collapsed line ranges
  - Clicking gutter opens comment input with correct line range
  - Comments placed in rendered view appear in raw view at same lines
  - Mermaid code blocks render as SVG
  - Non-markdown files do NOT show toggle
  - Modified markdown files do NOT show toggle

## Technical Requirements

- Follow existing feature file naming convention (sequential numbering: `12-rendered-markdown.feature`).
- Follow existing Gherkin style from other feature files in `tests/features/`.
- Documentation changes should be minimal and focused — don't rewrite sections, just add the new information.

### Meaningful Test Strategy Guidelines

**IMPORTANT**: Write a few tests, mostly integration.

**When TO Write Tests:** Custom business logic (line range extraction, eligibility check), critical user workflows (toggle, comment in rendered view, verify in raw view), integration between rendered view and comment system.

**When NOT to Write Tests:** react-markdown rendering (tested upstream), mermaid library functionality, Tailwind prose styling, basic React state management.

## Input Dependencies

Task 5: Feature fully integrated and working end-to-end.

## Output Artifacts

- Updated `AGENTS.md`
- Updated `docs/PRD.md`
- New `tests/features/12-rendered-markdown.feature`

## Implementation Notes

<details>

### AGENTS.md changes

1. In the **Tech Stack** section, add:
   - `react-markdown` (rendered markdown view with AST positions)
   - `mermaid` (Mermaid diagram rendering)
   - `@tailwindcss/typography` (prose styling for rendered markdown)

2. In the **Project Structure** under `DiffViewer/`, add:
   ```
   │           │   ├── RenderedMarkdownView.tsx # Rendered markdown with source-line-mapped gutter
   ```

### docs/PRD.md changes

Read the current PRD to find:
- Section 5.3.2 (or equivalent diff view modes section) — add a paragraph about the rendered markdown toggle
- Section 2 (Tech Stack table) — add the three new dependencies

### E2E Feature file

Follow the pattern from existing feature files. Example structure:

```gherkin
Feature: Rendered Markdown View
  As a reviewer
  I want to view new markdown files in rendered format
  So that I can review formatted content more naturally

  Scenario: New markdown file shows rendered toggle
    Given I open a diff with a new markdown file "README.md"
    Then I should see a "Rendered" toggle in the file header

  Scenario: Toggle switches to rendered view
    Given I open a diff with a new markdown file "README.md"
    When I click the "Rendered" toggle
    Then I should see the markdown rendered as formatted HTML
    And I should see a gutter with line ranges

  Scenario: Comment on rendered block
    Given I open a diff with a new markdown file "README.md"
    And I switch to rendered view
    When I click on the gutter for a paragraph block
    Then the comment input should open with the correct line range

  # ... additional scenarios
```

Study existing feature files for exact Given/When/Then phrasing patterns and step definitions.

**Note**: E2E tests cannot run in the dev container. The feature file is the specification — step definitions may be implemented later if needed.

</details>
