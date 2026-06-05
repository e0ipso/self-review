---
schema_version: 1
id: >-
  practice-honor-bootstrapmodel-name-from-kb-config-when-delegating-to-sub-agents
title: Honor `bootstrapModel.name` from KB config when delegating to sub-agents
kind: practice
tags:
  - knowledge-base
  - config
  - sub-agents
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  If `bootstrapModel.name` is set in the KB config, pass it as the sub-agent's
  model; otherwise omit it so the sub-agent inherits its default.
---
Read `.ai/knowledge-base/config.yaml` (falling back to `~/.config/ai-knowledge-base/config.yaml`) and look for a `bootstrapModel:` block. Accepted values for `bootstrapModel.name` are `haiku`, `sonnet`, or `opus`.

**Why:** Project owners may want bootstrap delegations to run on a specific tier. **How to apply:** Only set the model when delegating to a sub-agent and only when the config key is present.
