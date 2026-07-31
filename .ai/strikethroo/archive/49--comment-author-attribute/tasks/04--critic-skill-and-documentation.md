---
id: 4
group: "comment-author-attribute"
dependencies: [1]
status: "completed"
created: 2026-04-03
skills:
  - documentation
  - markdown
---
# Critic Skill and Documentation Updates

## Objective

Update the self-review-critique skill to emit `author` attributes on generated comments, and update AGENTS.md documentation to reflect the new attribute.

## Skills Required

- Markdown/documentation editing
- Understanding of the self-review XML format

## Acceptance Criteria

- [ ] `.claude/skills/self-review-critique/SKILL.md` instructs the LLM to include `author="<model-name>"` on each `<comment>` element
- [ ] XML examples in the critic skill include the `author` attribute
- [ ] `AGENTS.md` documents the `author` attribute in relevant sections (IPC/XML comment structure)
- [ ] Documentation is accurate and consistent with the implementation

## Technical Requirements

- Files to modify:
  - `.claude/skills/self-review-critique/SKILL.md`
  - `AGENTS.md`

## Input Dependencies

Task 01 must be completed (schema and types defined).

## Output Artifacts

- Updated critic skill with author attribution instructions
- Updated AGENTS.md documentation
