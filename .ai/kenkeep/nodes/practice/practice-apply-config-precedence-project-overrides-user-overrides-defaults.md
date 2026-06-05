---
schema_version: 1
id: practice-apply-config-precedence-project-overrides-user-overrides-defaults
title: 'Apply config precedence: project overrides user overrides defaults'
kind: practice
tags:
  - config
  - precedence
derived_from:
  - README.md
relates_to: []
confidence: high
summary: >-
  `.self-review.yaml` overrides `~/.config/self-review/config.yaml`, which
  overrides built-in defaults.
---
From the Configuration section: "Project config overrides user config, which overrides built-in defaults." User config lives at `~/.config/self-review/config.yaml`; project config at `.self-review.yaml` (committable).

**Why:** Lets teams commit shared project settings while allowing personal overrides at the user level and sensible fallbacks when neither is present.

**How to apply:** When adding new config options, ensure the merge order is preserved and the option is documented in both the README options list and `docs/PRD.md`.
