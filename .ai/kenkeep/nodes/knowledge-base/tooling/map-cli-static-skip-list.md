---
type: map
title: CLI static skip list
description: >-
  The CLI pre-filters `LICENSE`, `CHANGELOG`, `CODE_OF_CONDUCT`, `CONTRIBUTORS`,
  `INDEX.md`, `GRAPH.md`, and `releases/**/*.md` from bootstrap candidates.
tags:
  - knowledge-base
  - cli
  - skip-list
kk_schema_version: 3
kk_id: map-cli-static-skip-list
kk_derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Before the kb-bootstrap skill sees the candidate list, the CLI has already applied `.gitignore`, project include/exclude rules, and a static filename skip list covering `LICENSE`, `CHANGELOG`, `CODE_OF_CONDUCT`, `CONTRIBUTORS`, `INDEX.md`, `GRAPH.md`, and anything under `releases/**/*.md`. These never appear in the dry-run output.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-bootstrap/SKILL.md](.cursor/skills/kb-bootstrap/SKILL.md)
<!-- kk:citations:end -->
