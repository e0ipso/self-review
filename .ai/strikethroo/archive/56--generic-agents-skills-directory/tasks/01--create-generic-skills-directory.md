---
id: 1
group: "skills-migration"
dependencies: []
status: "completed"
created: "2026-05-18"
skills:
  - bash
  - filesystem
---

# Create generic `.agents/skills/` directory tree

## Objective
Create `.agents/skills/self-review-apply/` and `.agents/skills/self-review-critique/` directories and copy the exact same files currently present under `.claude/skills/`, preserving nested subdirectories (e.g., `assets/`).

## Skills Required
- `bash`: For directory creation and copy commands
- `filesystem`: For file tree operations

## Acceptance Criteria
- [ ] `.agents/skills/` directory exists
- [ ] `.agents/skills/self-review-apply/SKILL.md` exists with identical content to `.claude/skills/self-review-apply/SKILL.md`
- [ ] `.agents/skills/self-review-apply/assets/self-review-v1.xsd` exists with identical content
- [ ] `.agents/skills/self-review-critique/SKILL.md` exists with identical content to `.claude/skills/self-review-critique/SKILL.md`

## Technical Requirements
- Use `mkdir -p` to create nested directories
- Use `cp -r` or equivalent to copy files while preserving structure

## Input Dependencies
- Source files in `.claude/skills/` (verified to be byte-identical to `.opencode/skills/`)

## Output Artifacts
- `.agents/skills/self-review-apply/SKILL.md`
- `.agents/skills/self-review-apply/assets/self-review-v1.xsd`
- `.agents/skills/self-review-critique/SKILL.md`

## Implementation Notes
<details>
Use the following commands:

```bash
mkdir -p .agents/skills/self-review-apply/assets
mkdir -p .agents/skills/self-review-critique
cp .claude/skills/self-review-apply/SKILL.md .agents/skills/self-review-apply/SKILL.md
cp .claude/skills/self-review-apply/assets/self-review-v1.xsd .agents/skills/self-review-apply/assets/self-review-v1.xsd
cp .claude/skills/self-review-critique/SKILL.md .agents/skills/self-review-critique/SKILL.md
```

Then verify with `diff -r .claude/skills .agents/skills` to ensure contents match exactly.
</details>
