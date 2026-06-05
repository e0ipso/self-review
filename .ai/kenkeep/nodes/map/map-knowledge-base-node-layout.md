---
schema_version: 1
id: map-knowledge-base-node-layout
title: Knowledge base node layout
kind: map
tags:
  - knowledge-base
  - layout
  - nodes
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  Nodes live under `.ai/knowledge-base/nodes/<kind>/<kind>-<slug>.md`, with
  `<kind>` being `practice` or `map`.
---
Each node is a markdown file written at `.ai/knowledge-base/nodes/<kind>/<kind>-<slug>.md`. The `<kind>` segment is either `practice` (imperative project guidance) or `map` (what exists — features, vocabulary, locations).

Nodes carry standard frontmatter: `schema_version`, `id`, `title`, `kind`, `tags`, `derived_from`, `relates_to`, `confidence`, `summary`, followed by a markdown body of 1–4 short paragraphs.
