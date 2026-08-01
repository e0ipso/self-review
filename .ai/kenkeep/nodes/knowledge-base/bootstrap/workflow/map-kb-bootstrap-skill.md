---
type: map
title: kb-bootstrap skill
description: >-
  One-time, supervised skill that seeds the project knowledge base from existing
  markdown documentation.
tags:
  - knowledge-base
  - skill
kk_schema_version: 3
kk_id: map-kb-bootstrap-skill
kk_derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`kb-bootstrap` is the first-time bootstrap skill for this project's knowledge base. It surveys existing markdown documentation, follows cross-references, extracts candidate practice and map nodes, and writes them as new files under `.ai/knowledge-base/nodes/`.

The user supervises in-session: they review every node with `git diff`, accept with `git commit`, and reject with `git restore <path>`. It is one-pass and never overwrites existing nodes.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-bootstrap/SKILL.md](.cursor/skills/kb-bootstrap/SKILL.md)
<!-- kk:citations:end -->
