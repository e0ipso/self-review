---
type: map
title: Knowledge node placement
description: >-
  Stable node IDs live in topical folders, independent of practice/map kind.
tags:
  - knowledge-base
  - layout
  - nodes
kk_schema_version: 3
kk_id: map-knowledge-base-node-layout
kk_derived_from:
  - .agents/skills/kk-curate/SKILL.md
kk_relates_to:
  - map-ai-knowledge-base-directory
kk_depends_on: []
kk_confidence: high
---
Write leaves to `.ai/kenkeep/nodes/<topic>/<id>.md`. Existing folders are selected by topic; new nodes without a suitable folder fall back to `nodes/`. A curation modify resolves an existing leaf by ID and updates it in place. Only the final trigger-driven rebalance phase changes structure.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-curate/SKILL.md](../../../../../.agents/skills/kk-curate/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-ai-knowledge-base-directory](map-ai-knowledge-base-directory.md)
<!-- kk:related:end -->
