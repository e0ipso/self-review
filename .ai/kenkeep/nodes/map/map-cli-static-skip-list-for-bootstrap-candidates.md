---
schema_version: 1
id: map-cli-static-skip-list-for-bootstrap-candidates
title: CLI static skip list for bootstrap candidates
kind: map
tags:
  - knowledge-base
  - cli
  - skip-list
  - bootstrap
derived_from:
  - .ai/knowledge-base/nodes/map/map-cli-static-skip-list.md
relates_to: []
confidence: high
summary: >-
  Pre-filter list of filenames the ai-knowledge-base CLI excludes from bootstrap
  candidates before the skill runs.
---
The ai-knowledge-base CLI applies a static filename skip list before the kb-bootstrap skill sees the candidate documentation files. This pre-filter runs in addition to `.gitignore` and project include/exclude rules.

The skip list covers `LICENSE`, `CHANGELOG`, `CODE_OF_CONDUCT`, `CONTRIBUTORS`, `INDEX.md`, `GRAPH.md`, and anything matching `releases/**/*.md`. Files matching these patterns never appear in the dry-run candidate output.
