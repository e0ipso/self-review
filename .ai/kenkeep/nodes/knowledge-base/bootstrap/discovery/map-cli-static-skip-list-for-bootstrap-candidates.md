---
type: map
title: Bootstrap document exclusions
description: >-
  finddocs applies gitignore, kkignore and its static filename exclusions.
tags:
  - knowledge-base
  - cli
  - skip-list
  - bootstrap
kk_schema_version: 3
kk_id: map-cli-static-skip-list-for-bootstrap-candidates
kk_derived_from:
  - .agents/skills/kk-bootstrap/SKILL.md
kk_relates_to:
  - map-kb-bootstrap-skill
kk_depends_on: []
kk_confidence: high
---
`kenkeep finddocs` filters candidate Markdown using `.gitignore`, `.kkignore` and a static skip list before bootstrap reads them. Documented exclusions include LICENSE, CHANGELOG, CODE_OF_CONDUCT, CONTRIBUTORS, ENTRY.md, GRAPH.md and releases/**/*.md. Use the primitive rather than maintaining a second skip list.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-bootstrap/SKILL.md](../../../../../../.agents/skills/kk-bootstrap/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-kb-bootstrap-skill](../workflow/map-kb-bootstrap-skill.md)
<!-- kk:related:end -->
