---
id: 4
group: "rendered-html-support"
dependencies: [1, 2]
status: "completed"
created: 2026-05-13
skills:
  - documentation
---
# Document HTML Rendered Review Support

## Objective
Update product and developer-facing documentation so rendered review capabilities clearly include added HTML files alongside Markdown.

## Skills Required
This task requires documentation skills because it updates existing project docs to reflect implemented behavior without changing code.

## Acceptance Criteria
- [x] `docs/PRD.md` describes rendered review support for added HTML files in the same preview capabilities area that covers Markdown.
- [x] Documentation mentions `.html` and `.htm` support if both extensions are implemented.
- [x] Documentation states that rendered HTML supports gutter-based line-range comments in rendered view.
- [x] Any existing architecture notes that describe rendered preview eligibility mention the shared Markdown/HTML rendered-text path.
- [x] Documentation does not claim new preview modes, runtime network behavior, or unsupported non-added HTML rendering.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Keep the documentation aligned with the final implementation from Tasks 1 and 2. Avoid speculative future behavior.

## Input Dependencies
Tasks 1 and 2 should be complete so the docs can match actual helper behavior, extension coverage, and rendered-mode defaults.

## Output Artifacts
- Updated `docs/PRD.md`.
- Updated developer-facing architecture notes if any existing rendered preview eligibility notes are found.

## Implementation Notes
<details>
<summary>Detailed implementation guidance</summary>

1. Read the preview capability section of `docs/PRD.md` before editing.
2. Add HTML support where Markdown rendered behavior is already described, instead of creating a disconnected new section.
3. Use precise wording:
   - support is for added HTML files;
   - Raw/Rendered toggle is available;
   - rendered mode supports gutter-based comments mapped to new-line ranges;
   - raw diff mode remains available.
4. Search for existing architecture notes that mention rendered preview eligibility or Markdown-only rendered review. Update only those notes that would become inaccurate after HTML support lands.
5. Do not document implementation internals that users do not need, except for concise developer-facing notes about the shared Markdown/HTML rendered-text path if an architecture note already exists.
</details>
