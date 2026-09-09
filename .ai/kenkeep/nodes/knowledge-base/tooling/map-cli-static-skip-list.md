---
type: map
title: Bootstrap document exclusions
description: >-
  finddocs applies gitignore, kkignore and its static filename exclusions.
tags:
  - knowledge-base
  - cli
  - skip-list
kk_schema_version: 3
kk_id: map-cli-static-skip-list
kk_derived_from:
  - .agents/skills/kk-bootstrap/SKILL.md
kk_relates_to:
  - map-ai-knowledge-base-cli
kk_depends_on: []
kk_confidence: high
---
`kenkeep finddocs` filters candidate Markdown using `.gitignore`, `.kkignore` and a static skip list before bootstrap reads them. Documented exclusions include LICENSE, CHANGELOG, CODE_OF_CONDUCT, CONTRIBUTORS, ENTRY.md, GRAPH.md and releases/**/*.md. Use the primitive rather than maintaining a second skip list.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-bootstrap/SKILL.md](../../../../../.agents/skills/kk-bootstrap/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-ai-knowledge-base-cli](map-ai-knowledge-base-cli.md)
<!-- kk:related:end -->
