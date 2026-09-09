---
type: practice
title: Do not duplicate or overwrite existing nodes during bootstrap
description: >-
  Skip and report candidates whose scope is already covered.
tags:
  - knowledge-base
  - node-authoring
  - collision
kk_schema_version: 3
kk_id: practice-never-overwrite-an-existing-node-during-bootstrap
kk_derived_from:
  - .agents/skills/kk-bootstrap/SKILL.md
kk_relates_to:
  - map-kb-bootstrap-skill
kk_depends_on: []
kk_confidence: high
---
Check the existing knowledge tree before writing. If a candidate is already covered, skip and report it instead of creating a suffixed sibling. Bootstrap writes new nodes; refinements belong in curation. IDs are independent of topical folder placement.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-bootstrap/SKILL.md](../../../../../../.agents/skills/kk-bootstrap/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-kb-bootstrap-skill](../workflow/map-kb-bootstrap-skill.md)
<!-- kk:related:end -->
