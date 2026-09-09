---
type: map
title: 'Curator persistence results'
description: >-
  curate-persist reports written, dropped and failed actions with per-action
  results.
tags:
  - kk-curate
  - failures
  - reasons
kk_schema_version: 3
kk_id: map-curator-failure-modes-add-collision-and-modify-missing-target
kk_derived_from:
  - .agents/skills/kk-curate/SKILL.md
kk_relates_to:
  - map-knowledge-base-capture-curate-review-workflow
kk_depends_on: []
kk_confidence: high
---
`curate-persist` validates its input and reports `written`, `dropped`, `failed` and per-action `results`. Successful writes remain when another action fails. A modify whose target ID is absent fails rather than creating a replacement node. Inspect actual error details and report partial failures; do not claim success from a valid draft alone.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-curate/SKILL.md](../../../../../.agents/skills/kk-curate/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-knowledge-base-capture-curate-review-workflow](map-knowledge-base-capture-curate-review-workflow.md)
<!-- kk:related:end -->
