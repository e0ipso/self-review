---
schema_version: 1
id: practice-compute-conflict-resolution-defaults-from-diff-ratio-and-confidence
title: Compute conflict-resolution defaults from diff ratio and confidence
kind: practice
tags:
  - kb-curate
  - conflicts
  - defaults
derived_from:
  - .cursor/skills/kb-curate/SKILL.md
relates_to: []
confidence: high
summary: >-
  Default `y` for small high-confidence diffs (<5 lines), `n` for >50% changed,
  otherwise `s`; `s` when no target node exists.
---
Before prompting the user on each conflict, compute `lines_changed` (line-granularity diff between proposed and existing body), `total_lines = max(proposed, existing)`, and `ratio = lines_changed / total_lines`. Apply in order, stopping at first match: (1) if `lines_changed < 5` AND `proposed_confidence == "high"` → default `y`; (2) if `ratio > 0.5` → default `n`; (3) otherwise → default `s`. If the conflict has no `target_node_id`, default to `s`.

**Why:** Deterministic defaults steer the reviewer toward likely-correct outcomes without overriding their judgment — they remain recommendations, not determinations.

**How to apply:** Always show both proposed and existing content before asking; the default only seeds the prompt.
