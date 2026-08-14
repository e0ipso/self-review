---
type: practice
title: >-
  Short-circuit kb-curate with one-line summary when no conflicts and no
  failures
description: >-
  If conflicts==0 AND failures.length==0, print one summary line and stop — skip
  every later step.
tags:
  - kb-curate
  - fast-path
  - summary
kk_schema_version: 3
kk_id: >-
  practice-short-circuit-kb-curate-with-one-line-summary-when-no-conflicts-and-no-failures
kk_derived_from:
  - .cursor/skills/kb-curate/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
After the curator returns, if `conflicts == 0` AND `failures.length == 0`, print exactly: `Curated <nodes_written> nodes; <drops> dropped; no conflicts. Review with: git diff .ai/knowledge-base/` and stop. Do not proceed to conflict resolution or hand-off steps.

**Why:** Avoids walking empty conflict directories and noisy multi-step output when the run was clean.

**How to apply:** Otherwise (any conflicts or failures), report headline numbers (nodes written, drops, batches, run id) and surface each `add_collision` or `modify_missing_target` failure verbatim with its `reason` and `detail`.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-curate/SKILL.md](.cursor/skills/kb-curate/SKILL.md)
<!-- kk:citations:end -->
