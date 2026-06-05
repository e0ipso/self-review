---
schema_version: 1
id: >-
  practice-short-circuit-kb-curate-with-one-line-summary-when-no-conflicts-and-no-failures
title: >-
  Short-circuit kb-curate with one-line summary when no conflicts and no
  failures
kind: practice
tags:
  - kb-curate
  - fast-path
  - summary
derived_from:
  - .cursor/skills/kb-curate/SKILL.md
relates_to: []
confidence: high
summary: >-
  If conflicts==0 AND failures.length==0, print one summary line and stop — skip
  every later step.
---
After the curator returns, if `conflicts == 0` AND `failures.length == 0`, print exactly: `Curated <nodes_written> nodes; <drops> dropped; no conflicts. Review with: git diff .ai/knowledge-base/` and stop. Do not proceed to conflict resolution or hand-off steps.

**Why:** Avoids walking empty conflict directories and noisy multi-step output when the run was clean.

**How to apply:** Otherwise (any conflicts or failures), report headline numbers (nodes written, drops, batches, run id) and surface each `add_collision` or `modify_missing_target` failure verbatim with its `reason` and `detail`.
