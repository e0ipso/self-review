---
schema_version: 1
id: practice-apply-config-precedence-cli-project-yaml-user-yaml-defaults
title: 'Apply config precedence: CLI > project YAML > user YAML > defaults'
kind: practice
tags:
  - config
  - precedence
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  Higher-priority values override lower-priority values on a per-key shallow
  merge.
---
Configuration is resolved in this precedence order, highest to lowest:

1. CLI flags (e.g., `--resume-from`)
2. Project-level config (`.self-review.yaml` in the repo root)
3. User-level config (`~/.config/self-review/config.yaml`)
4. Built-in defaults

Merging is shallow and per-key. Invalid keys are ignored with a warning to stderr; invalid values produce a warning and fall back to the default. The app must not crash due to malformed configuration.
