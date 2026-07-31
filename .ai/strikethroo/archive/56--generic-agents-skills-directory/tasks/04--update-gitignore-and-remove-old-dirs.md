---
id: 4
group: "skills-migration"
dependencies:
  - 1
status: "completed"
created: "2026-05-18"
skills:
  - git
  - bash
---

# Update `.gitignore` and remove old skill directories from version control

## Objective
Stop tracking `.claude/skills/` and `.opencode/skills/` by removing their negation patterns from `.gitignore`, then delete the directories from the working tree and stage the deletions.

## Skills Required
- `git`: Understanding `.gitignore` negation and `git rm`
- `bash`: File and git operations

## Acceptance Criteria
- [ ] `.gitignore` no longer contains `!.claude/skills/` or `!.opencode/skills/`
- [ ] `.gitignore` still contains `.claude/*` and `.opencode/*` ignore rules
- [ ] `git ls-files | grep -E '^\.(claude|opencode)/skills/'` returns empty
- [ ] `.claude/skills/` and `.opencode/skills/` are removed from working tree

## Technical Requirements
- Use `git rm -r` to delete tracked directories and stage removal simultaneously
- Do NOT delete the parent `.claude/` or `.opencode/` directories themselves

## Input Dependencies
- Task 1: New `.agents/skills/` must exist before deleting old copies

## Output Artifacts
- Updated `.gitignore`
- Staged deletions in Git index

## Implementation Notes
<details>
1. Edit `.gitignore` to remove these two lines:
   ```
   !.claude/skills/
   !.opencode/skills/
   ```
2. Run:
   ```bash
   git rm -r .claude/skills/ .opencode/skills/
   ```
3. Verify:
   ```bash
   git ls-files | grep -E '^\.(claude|opencode)/skills/'
   ```
   Should return nothing.
</details>
