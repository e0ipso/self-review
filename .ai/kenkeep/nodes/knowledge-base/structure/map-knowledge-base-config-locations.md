---
type: map
title: Knowledge base configuration
description: >-
  Read project kenkeep configuration, with the user config fallback.
tags:
  - knowledge-base
  - config
kk_schema_version: 3
kk_id: map-knowledge-base-config-locations
kk_derived_from:
  - .agents/skills/kk-bootstrap/SKILL.md
  - .ai/kenkeep/config.yaml
kk_relates_to:
  - map-ai-knowledge-base-directory
kk_depends_on: []
kk_confidence: high
---
Read `.ai/kenkeep/config.yaml`, falling back to `~/.config/kenkeep/config.yaml`, for preferences relevant to the operation. The project config documents harness-discriminated `proposalModel` and `curatorModel` settings and the plain-shell `cliDefaultHarness` selection. Do not assume an undocumented `bootstrapModel.name` setting controls batch agents.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-bootstrap/SKILL.md](../../../../../.agents/skills/kk-bootstrap/SKILL.md)
[2] [.ai/kenkeep/config.yaml](../../../config.yaml)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-ai-knowledge-base-directory](map-ai-knowledge-base-directory.md)
<!-- kk:related:end -->
