---
type: map
title: Knowledge base node layout
description: >-
  Nodes live under `.ai/knowledge-base/nodes/<kind>/<kind>-<slug>.md`, with
  `<kind>` being `practice` or `map`.
tags:
  - knowledge-base
  - layout
  - nodes
kk_schema_version: 3
kk_id: map-knowledge-base-node-layout
kk_derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Each node is a markdown file written at `.ai/knowledge-base/nodes/<kind>/<kind>-<slug>.md`. The `<kind>` segment is either `practice` (imperative project guidance) or `map` (what exists — features, vocabulary, locations).

Nodes carry standard frontmatter: `schema_version`, `id`, `title`, `kind`, `tags`, `derived_from`, `relates_to`, `confidence`, `summary`, followed by a markdown body of 1–4 short paragraphs.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-bootstrap/SKILL.md](.cursor/skills/kb-bootstrap/SKILL.md)
<!-- kk:citations:end -->
