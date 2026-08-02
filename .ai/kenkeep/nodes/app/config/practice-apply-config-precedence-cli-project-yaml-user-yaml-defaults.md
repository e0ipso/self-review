---
type: practice
title: 'Apply config precedence: CLI > project YAML > user YAML > defaults'
description: >-
  Higher-priority values override lower-priority values on a per-key shallow
  merge.
tags:
  - config
  - precedence
kk_schema_version: 3
kk_id: practice-apply-config-precedence-cli-project-yaml-user-yaml-defaults
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Configuration is resolved in this precedence order, highest to lowest:

1. CLI flags (e.g., `--resume-from`)
2. Project-level config (`.self-review.yaml` in the repo root)
3. User-level config (`~/.config/self-review/config.yaml`)
4. Built-in defaults

Merging is shallow and per-key. Invalid keys are ignored with a warning to stderr; invalid values produce a warning and fall back to the default. The app must not crash due to malformed configuration.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
