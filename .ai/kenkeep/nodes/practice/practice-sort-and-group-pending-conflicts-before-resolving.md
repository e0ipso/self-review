---
schema_version: 1
id: practice-sort-and-group-pending-conflicts-before-resolving
title: Sort and group pending conflicts before resolving
kind: practice
tags:
  - kb-curate
  - conflicts
  - grouping
derived_from:
  - .cursor/skills/kb-curate/SKILL.md
relates_to: []
confidence: high
summary: >-
  Sort pending conflicts by target_node_id, proposed_kind, detected_at; show the
  shared existing node once per group.
---
List markdown files under `.ai/knowledge-base/conflicts/`, keep only those whose `status` is `pending`, then sort by: (1) `target_node_id` alphabetic (nulls last); (2) `proposed_kind`; (3) `detected_at`. Consecutive conflicts sharing a non-null `target_node_id` form a group: show the existing node body ONCE at the top, then walk each proposed contradiction individually. Conflicts with `target_node_id: null` are walked alone.

**Why:** Avoids re-displaying the same existing node for every contradiction against it, keeping the reviewer's context coherent.

**How to apply:** Skip the entire conflicts section if no pending files remain after filtering.
