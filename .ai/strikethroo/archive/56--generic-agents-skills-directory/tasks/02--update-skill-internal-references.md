---
id: 2
group: "skills-migration"
dependencies:
  - 1
status: "completed"
created: "2026-05-18"
skills:
  - markdown
  - bash
---

# Update skill internal path references

## Objective
Update `.agents/skills/self-review-critique/SKILL.md` to replace hardcoded `.claude/skills/self-review-apply/assets/self-review-v1.xsd` references with `.agents/skills/self-review-apply/assets/self-review-v1.xsd`.

## Skills Required
- `markdown`: Editing a SKILL.md document
- `bash`: Using sed or similar for find-and-replace

## Acceptance Criteria
- [ ] All occurrences of `.claude/skills/self-review-apply/assets/self-review-v1.xsd` in `.agents/skills/self-review-critique/SKILL.md` are replaced with `.agents/skills/self-review-apply/assets/self-review-v1.xsd`
- [ ] `.agents/skills/self-review-apply/SKILL.md` requires no changes (it uses relative `assets/` paths)

## Technical Requirements
- Preserve all other content, formatting, and frontmatter
- Use `sed -i` or `edit` tool to perform replacements

## Input Dependencies
- Task 1: The new `.agents/skills/self-review-critique/SKILL.md` file must exist

## Output Artifacts
- Updated `.agents/skills/self-review-critique/SKILL.md`

## Implementation Notes
<details>
There are exactly two occurrences to replace (lines 95 and 131 in the original). Run:

```bash
sed -i 's|\.claude/skills/self-review-apply/assets/self-review-v1.xsd|.agents/skills/self-review-apply/assets/self-review-v1.xsd|g' .agents/skills/self-review-critique/SKILL.md
```

Then verify with:
```bash
grep -n '\.claude/skills' .agents/skills/self-review-critique/SKILL.md || echo "No stale references found"
```
</details>
