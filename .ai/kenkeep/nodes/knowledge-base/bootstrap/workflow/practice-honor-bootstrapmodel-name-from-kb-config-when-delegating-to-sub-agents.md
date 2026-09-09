---
type: practice
title: Use documented configuration when drafting bootstrap nodes
description: >-
  Apply current project preferences and the shared delegation contract.
tags:
  - knowledge-base
  - config
  - subagents
kk_schema_version: 3
kk_id: >-
  practice-honor-bootstrapmodel-name-from-kb-config-when-delegating-to-sub-agents
kk_derived_from:
  - .agents/skills/kk-bootstrap/SKILL.md
  - .ai/kenkeep/.config/prompts/sub-agent-delegation.md
kk_relates_to:
  - map-kb-bootstrap-skill
kk_depends_on: []
kk_confidence: high
---
Read `.ai/kenkeep/config.yaml` or the user fallback for relevant preferences. Follow `.ai/kenkeep/.config/prompts/sub-agent-delegation.md` for the available-tool probe and batch limits. The current bootstrap skill does not define a `bootstrapModel.name` override; do not invent that setting.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-bootstrap/SKILL.md](../../../../../../.agents/skills/kk-bootstrap/SKILL.md)
[2] [.ai/kenkeep/.config/prompts/sub-agent-delegation.md](../../../../.config/prompts/sub-agent-delegation.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-kb-bootstrap-skill](map-kb-bootstrap-skill.md)
<!-- kk:related:end -->
