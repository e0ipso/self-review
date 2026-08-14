---
type: map
title: Knowledge base config locations
description: >-
  KB config is read from `.ai/knowledge-base/config.yaml`, with fallback to
  `~/.config/ai-knowledge-base/config.yaml`.
tags:
  - knowledge-base
  - config
kk_schema_version: 3
kk_id: map-knowledge-base-config-locations
kk_derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The kb-bootstrap skill reads configuration from `.ai/knowledge-base/config.yaml` first, then falls back to `~/.config/ai-knowledge-base/config.yaml`. Relevant keys include `bootstrapModel.name` (one of `haiku`, `sonnet`, `opus`) for sub-agent model selection, and `cliDefaultHarness` for harness resolution defaults.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-bootstrap/SKILL.md](.cursor/skills/kb-bootstrap/SKILL.md)
<!-- kk:citations:end -->
