---
type: practice
title: Honor `bootstrapModel.name` from KB config when delegating to sub-agents
description: >-
  If `bootstrapModel.name` is set in the KB config, pass it as the sub-agent's
  model; otherwise omit it so the sub-agent inherits its default.
tags:
  - knowledge-base
  - config
  - sub-agents
kk_schema_version: 3
kk_id: >-
  practice-honor-bootstrapmodel-name-from-kb-config-when-delegating-to-sub-agents
kk_derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Read `.ai/knowledge-base/config.yaml` (falling back to `~/.config/ai-knowledge-base/config.yaml`) and look for a `bootstrapModel:` block. Accepted values for `bootstrapModel.name` are `haiku`, `sonnet`, or `opus`.

**Why:** Project owners may want bootstrap delegations to run on a specific tier. **How to apply:** Only set the model when delegating to a sub-agent and only when the config key is present.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-bootstrap/SKILL.md](.cursor/skills/kb-bootstrap/SKILL.md)
<!-- kk:citations:end -->
