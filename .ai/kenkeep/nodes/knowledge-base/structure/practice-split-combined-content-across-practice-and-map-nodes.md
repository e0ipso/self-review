---
type: practice
title: Split combined content across practice and map nodes
description: >-
  When content has both imperative and named-entity aspects, split it: practice
  owns the rule; map owns the definition.
tags:
  - knowledge-base
  - node-authoring
  - ownership
kk_schema_version: 3
kk_id: practice-split-combined-content-across-practice-and-map-nodes
kk_derived_from:
  - .agents/skills/kk-bootstrap/SKILL.md
kk_relates_to:
  - map-ai-knowledge-base-directory
kk_depends_on: []
kk_confidence: high
---
For example, "Use bravo_analytics.dispatcher, our service for tracking events" becomes two nodes: a practice node ("use the dispatcher") and a map node ("what the dispatcher is").

**Why:** Practice owns imperative knowledge; map owns named-entity definitions. **How to apply:** Whenever you spot a candidate that mixes a convention with a definition, emit one of each kind rather than cramming both into one node.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-bootstrap/SKILL.md](../../../../../.agents/skills/kk-bootstrap/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-ai-knowledge-base-directory](map-ai-knowledge-base-directory.md)
<!-- kk:related:end -->
