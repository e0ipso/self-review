---
schema_version: 1
id: map-knowledge-base-config-locations
title: Knowledge base config locations
kind: map
tags:
  - knowledge-base
  - config
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  KB config is read from `.ai/knowledge-base/config.yaml`, with fallback to
  `~/.config/ai-knowledge-base/config.yaml`.
---
The kb-bootstrap skill reads configuration from `.ai/knowledge-base/config.yaml` first, then falls back to `~/.config/ai-knowledge-base/config.yaml`. Relevant keys include `bootstrapModel.name` (one of `haiku`, `sonnet`, `opus`) for sub-agent model selection, and `cliDefaultHarness` for harness resolution defaults.
