---
id: 3
group: "skills-migration"
dependencies:
  - 1
status: "completed"
created: "2026-05-18"
skills:
  - markdown
  - documentation
---

# Update project documentation for `.agents/skills/`

## Objective
Update `AGENTS.md` and `README.md` to point exclusively to `.agents/skills/` for skill paths, XSD schema location, and installation instructions.

## Skills Required
- `markdown`: Editing project documentation
- `documentation`: Ensuring consistency across docs

## Acceptance Criteria
- [ ] `AGENTS.md` "XSD Schema Location" section references `.agents/skills/self-review-apply/assets/self-review-v1.xsd`
- [ ] `AGENTS.md` "Assistant Skills" section references `.agents/skills/self-review-apply/SKILL.md`
- [ ] `AGENTS.md` "XSD sync" note references `.agents/skills/self-review-apply/assets/self-review-v1.xsd`
- [ ] `README.md` "Claude Code Skill" install command uses `.agents/skills/self-review-apply` as source
- [ ] `README.md` directory tree diagram under "Claude Code Skill" shows `.agents/skills/` instead of `.claude/skills/`

## Technical Requirements
- Do not modify archived plans (`.ai/task-manager/archive/`)
- Do not modify runtime code (`src/main/xml-serializer.ts` embedded XSD string is intentionally untouched)

## Input Dependencies
- Task 1: `.agents/skills/` directory exists so paths are valid

## Output Artifacts
- Updated `AGENTS.md`
- Updated `README.md`

## Implementation Notes
<details>
### AGENTS.md changes
- Line 256: change `.claude/skills/self-review-apply/assets/self-review-v1.xsd` to `.agents/skills/self-review-apply/assets/self-review-v1.xsd`
- Line 305: change `.claude/skills/self-review-apply/SKILL.md` to `.agents/skills/self-review-apply/SKILL.md`
- Line 309: change `.claude/skills/self-review-apply/assets/self-review-v1.xsd` to `.agents/skills/self-review-apply/assets/self-review-v1.xsd`

### README.md changes
- Line 228: change `cp -r .claude/skills/self-review-apply ...` to `cp -r .agents/skills/self-review-apply ...`
- Update the tree diagram (lines 243-250) to show `your-project/ -> .agents/ -> skills/ -> self-review-apply/` etc.

Use `sed` or `edit` tool for replacements, then verify with grep.
</details>
