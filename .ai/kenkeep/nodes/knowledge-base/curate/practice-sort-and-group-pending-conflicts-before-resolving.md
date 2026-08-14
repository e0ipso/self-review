---
type: practice
title: Sort and group pending conflicts before resolving
description: >-
  Sort pending conflicts by target_node_id, proposed_kind, detected_at; show the
  shared existing node once per group.
tags:
  - kb-curate
  - conflicts
  - grouping
kk_schema_version: 3
kk_id: practice-sort-and-group-pending-conflicts-before-resolving
kk_derived_from:
  - .cursor/skills/kb-curate/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
List markdown files under `.ai/knowledge-base/conflicts/`, keep only those whose `status` is `pending`, then sort by: (1) `target_node_id` alphabetic (nulls last); (2) `proposed_kind`; (3) `detected_at`. Consecutive conflicts sharing a non-null `target_node_id` form a group: show the existing node body ONCE at the top, then walk each proposed contradiction individually. Conflicts with `target_node_id: null` are walked alone.

**Why:** Avoids re-displaying the same existing node for every contradiction against it, keeping the reviewer's context coherent.

**How to apply:** Skip the entire conflicts section if no pending files remain after filtering.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-curate/SKILL.md](.cursor/skills/kb-curate/SKILL.md)
<!-- kk:citations:end -->
