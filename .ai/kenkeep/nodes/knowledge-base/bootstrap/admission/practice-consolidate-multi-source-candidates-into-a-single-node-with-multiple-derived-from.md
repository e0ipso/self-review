---
type: practice
title: >-
  Consolidate overlapping bootstrap candidates
description: >-
  Use one authoritative source and mention other supporting documents.
tags:
  - knowledge-base
  - deduplication
kk_schema_version: 3
kk_id: >-
  practice-consolidate-multi-source-candidates-into-a-single-node-with-multiple-derived-from
kk_derived_from:
  - .agents/skills/kk-bootstrap/SKILL.md
kk_relates_to:
  - map-kb-bootstrap-skill
kk_depends_on: []
kk_confidence: high
---
Do not create multiple bootstrap nodes for the same convention. Pass the most authoritative document and hash to `node write --source-doc ... --source-hash ...`, and mention other supporting documents in the body. Skip candidates already covered by an existing node.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-bootstrap/SKILL.md](../../../../../../.agents/skills/kk-bootstrap/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-kb-bootstrap-skill](../workflow/map-kb-bootstrap-skill.md)
<!-- kk:related:end -->
