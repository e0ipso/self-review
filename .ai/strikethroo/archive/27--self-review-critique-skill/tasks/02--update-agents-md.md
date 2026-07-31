---
id: 2
group: "documentation"
dependencies: [1]
status: "completed"
created: "2026-02-28"
skills:
  - documentation
---
# Update AGENTS.md with self-review-critique skill documentation

## Objective
Add documentation for the new `self-review-critique` skill to `AGENTS.md` so developers know it exists and how to use it.

## Skills Required
- documentation: Writing clear, concise technical documentation

## Acceptance Criteria
- [ ] `AGENTS.md` includes a section describing the `self-review-critique` skill
- [ ] Usage examples show common invocations
- [ ] The relationship to `self-review-apply` and `--resume-from` is explained

## Technical Requirements
- Add to the existing `AGENTS.md` structure
- Keep it concise — follow the existing documentation style

## Input Dependencies
- Task 1: The skill file must exist to document accurately

## Output Artifacts
- Updated `AGENTS.md` with skill documentation

## Implementation Notes

<details>

Add a brief section to AGENTS.md, near where other skills or keyboard shortcuts are documented. Include:

```markdown
## AI Code Review Skill

The `self-review-critique` skill (`/self-review-critique`) enables an AI assistant to critique a
git diff and generate a `review.xml` file with line-level comments and code suggestions. The output
can be loaded into self-review for human validation:

```bash
# AI critiques staged changes
/self-review-critique --staged

# Human reviews in self-review
self-review --staged --resume-from review.xml
```

The skill reads categories from `.self-review.yaml` and validates output against the XSD schema.
```

Keep it short. The skill's own SKILL.md is the detailed reference.

</details>
