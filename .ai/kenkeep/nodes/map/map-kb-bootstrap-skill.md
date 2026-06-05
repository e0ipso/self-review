---
schema_version: 1
id: map-kb-bootstrap-skill
title: kb-bootstrap skill
kind: map
tags:
  - knowledge-base
  - skill
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  One-time, supervised skill that seeds the project knowledge base from existing
  markdown documentation.
---
`kb-bootstrap` is the first-time bootstrap skill for this project's knowledge base. It surveys existing markdown documentation, follows cross-references, extracts candidate practice and map nodes, and writes them as new files under `.ai/knowledge-base/nodes/`.

The user supervises in-session: they review every node with `git diff`, accept with `git commit`, and reject with `git restore <path>`. It is one-pass and never overwrites existing nodes.
