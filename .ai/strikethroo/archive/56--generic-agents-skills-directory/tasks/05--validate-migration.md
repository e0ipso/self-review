---
id: 5
group: "skills-migration"
dependencies:
  - 2
  - 3
  - 4
status: "completed"
created: "2026-05-18"
skills:
  - bash
---

# Validate migration and confirm no stale references remain

## Objective
Perform systematic verification that the migration is complete, no stale paths exist, and Git state is correct.

## Skills Required
- `bash`: Running grep and git status commands

## Acceptance Criteria
- [ ] `ls -R .agents/skills/` shows both `self-review-apply/` and `self-review-critique/` with correct files
- [ ] `grep -r '\.claude/skills' /workspace --include='*.md' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' --include='*.yaml' --include='*.yml' | grep -v 'archive/' | grep -v 'worktrees/' | grep -v '\.git/'` returns zero matches
- [ ] Same grep for `\.opencode/skills` returns zero matches
- [ ] `grep -r '\.agents/skills' /workspace/AGENTS.md /workspace/README.md /workspace/.agents/skills/` returns expected references
- [ ] `git status` shows old directories as deleted and new `.agents/skills/` as untracked additions

## Technical Requirements
- Exclude historical/archive directories from search
- Exclude generated artifacts (`node_modules/`, `.git/`, `.claude/worktrees/`)

## Input Dependencies
- Task 2: Skill file references updated
- Task 3: Documentation references updated
- Task 4: Old directories removed from Git tracking

## Output Artifacts
- Validation report (stdout output)

## Implementation Notes
<details>
Run these validation commands:

```bash
# 1. Confirm new tree exists
ls -R .agents/skills/

# 2. Confirm old dirs are untracked/deleted
git status --short | grep -E '(claude|opencode)/skills'
# Should show 'D  .claude/skills/...' and 'D  .opencode/skills/...' plus '?? .agents/skills/...'

# 3. Grep for stale references
grep -r '\.claude/skills' /workspace \
  --include='*.md' --include='*.ts' --include='*.tsx' \
  --include='*.js' --include='*.json' --include='*.yaml' --include='*.yml' \
  | grep -v 'archive/' | grep -v 'worktrees/' | grep -v '\.git/' || echo "No stale .claude/skills references"

grep -r '\.opencode/skills' /workspace \
  --include='*.md' --include='*.ts' --include='*.tsx' \
  --include='*.js' --include='*.json' --include='*.yaml' --include='*.yml' \
  | grep -v 'archive/' | grep -v 'worktrees/' | grep -v '\.git/' || echo "No stale .opencode/skills references"

# 4. Confirm new references exist
grep -r '\.agents/skills' /workspace/AGENTS.md /workspace/README.md /workspace/.agents/skills/
```

If any stale references are found, report them and do not mark this task complete.
</details>
