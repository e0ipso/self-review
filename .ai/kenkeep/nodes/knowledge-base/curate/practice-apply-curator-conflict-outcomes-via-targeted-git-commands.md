---
type: practice
title: Apply curator conflict outcomes via targeted git commands
description: >-
  Accept rewrites the node and restores the conflict file; reject restores it;
  skip leaves it; keep commits it.
tags:
  - kb-curate
  - outcomes
  - git
kk_schema_version: 3
kk_id: practice-apply-curator-conflict-outcomes-via-targeted-git-commands
kk_derived_from:
  - .cursor/skills/kb-curate/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Map each chosen reply to actions: `y` — rewrite `nodes/<proposed_kind>/<target_node_id>.md` with the proposed body+frontmatter, then `git restore .ai/knowledge-base/conflicts/<id>.md`; user reviews node via `git diff` and commits. `n` — `git restore .ai/knowledge-base/conflicts/<id>.md`; node unchanged. `s` — leave the conflict file alone; it re-surfaces on the next curate pass with `status: pending` intact (do not edit or delete). `k` — `git commit` the conflict file; node unchanged. Use `k` rarely — it preserves the disagreement as a historical record.

**Why:** The conflict files are themselves git-tracked review artifacts; accepting/rejecting via `git restore`/`git commit` keeps the reviewer in control and avoids destructive automated edits.

**How to apply:** Edit `nodes/` only on `y`. Never modify or delete a conflict file directly on `s`.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-curate/SKILL.md](.cursor/skills/kb-curate/SKILL.md)
<!-- kk:citations:end -->
