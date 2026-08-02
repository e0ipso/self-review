---
type: practice
title: 'Apply config precedence: project overrides user overrides defaults'
description: >-
  `.self-review.yaml` overrides `~/.config/self-review/config.yaml`, which
  overrides built-in defaults.
tags:
  - config
  - precedence
kk_schema_version: 3
kk_id: practice-apply-config-precedence-project-overrides-user-overrides-defaults
kk_derived_from:
  - README.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
From the Configuration section: "Project config overrides user config, which overrides built-in defaults." User config lives at `~/.config/self-review/config.yaml`; project config at `.self-review.yaml` (committable).

**Why:** Lets teams commit shared project settings while allowing personal overrides at the user level and sensible fallbacks when neither is present.

**How to apply:** When adding new config options, ensure the merge order is preserved and the option is documented in both the README options list and `docs/PRD.md`.

<!-- kk:citations:start -->
# Citations

[1] [README.md](README.md)
<!-- kk:citations:end -->
