---
schema_version: 1
id: practice-apply-curator-conflict-outcomes-via-targeted-git-commands
title: Apply curator conflict outcomes via targeted git commands
kind: practice
tags:
  - kb-curate
  - outcomes
  - git
derived_from:
  - .cursor/skills/kb-curate/SKILL.md
relates_to: []
confidence: high
summary: >-
  Accept rewrites the node and restores the conflict file; reject restores it;
  skip leaves it; keep commits it.
---
Map each chosen reply to actions: `y` — rewrite `nodes/<proposed_kind>/<target_node_id>.md` with the proposed body+frontmatter, then `git restore .ai/knowledge-base/conflicts/<id>.md`; user reviews node via `git diff` and commits. `n` — `git restore .ai/knowledge-base/conflicts/<id>.md`; node unchanged. `s` — leave the conflict file alone; it re-surfaces on the next curate pass with `status: pending` intact (do not edit or delete). `k` — `git commit` the conflict file; node unchanged. Use `k` rarely — it preserves the disagreement as a historical record.

**Why:** The conflict files are themselves git-tracked review artifacts; accepting/rejecting via `git restore`/`git commit` keeps the reviewer in control and avoids destructive automated edits.

**How to apply:** Edit `nodes/` only on `y`. Never modify or delete a conflict file directly on `s`.
