---
type: practice
title: >-
  Consolidate multi-source candidates into a single node with multiple
  `derived_from`
description: >-
  When the same convention appears in multiple docs, write one node and list all
  source paths in `derived_from`.
tags:
  - knowledge-base
  - deduplication
kk_schema_version: 3
kk_id: >-
  practice-consolidate-multi-source-candidates-into-a-single-node-with-multiple-derived-from
kk_derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Do not produce duplicate nodes for the same rule. Instead, list every source doc that informed it in the `derived_from` array of a single node.

**Why:** Duplicates fragment the knowledge graph and waste reviewer attention. **How to apply:** When you spot a candidate you've already seen elsewhere, append the new source to the existing node instead of creating a new one.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-bootstrap/SKILL.md](.cursor/skills/kb-bootstrap/SKILL.md)
<!-- kk:citations:end -->
