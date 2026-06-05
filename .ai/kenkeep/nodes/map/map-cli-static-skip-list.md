---
schema_version: 1
id: map-cli-static-skip-list
title: CLI static skip list
kind: map
tags:
  - knowledge-base
  - cli
  - skip-list
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  The CLI pre-filters `LICENSE`, `CHANGELOG`, `CODE_OF_CONDUCT`, `CONTRIBUTORS`,
  `INDEX.md`, `GRAPH.md`, and `releases/**/*.md` from bootstrap candidates.
---
Before the kb-bootstrap skill sees the candidate list, the CLI has already applied `.gitignore`, project include/exclude rules, and a static filename skip list covering `LICENSE`, `CHANGELOG`, `CODE_OF_CONDUCT`, `CONTRIBUTORS`, `INDEX.md`, `GRAPH.md`, and anything under `releases/**/*.md`. These never appear in the dry-run output.
