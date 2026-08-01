---
type: map
title: CLI static skip list for bootstrap candidates
description: >-
  Pre-filter list of filenames the ai-knowledge-base CLI excludes from bootstrap
  candidates before the skill runs.
tags:
  - knowledge-base
  - cli
  - skip-list
  - bootstrap
kk_schema_version: 3
kk_id: map-cli-static-skip-list-for-bootstrap-candidates
kk_derived_from:
  - .ai/knowledge-base/nodes/map/map-cli-static-skip-list.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The ai-knowledge-base CLI applies a static filename skip list before the kb-bootstrap skill sees the candidate documentation files. This pre-filter runs in addition to `.gitignore` and project include/exclude rules.

The skip list covers `LICENSE`, `CHANGELOG`, `CODE_OF_CONDUCT`, `CONTRIBUTORS`, `INDEX.md`, `GRAPH.md`, and anything matching `releases/**/*.md`. Files matching these patterns never appear in the dry-run candidate output.

<!-- kk:citations:start -->
# Citations

[1] [.ai/knowledge-base/nodes/map/map-cli-static-skip-list.md](.ai/knowledge-base/nodes/map/map-cli-static-skip-list.md)
<!-- kk:citations:end -->
