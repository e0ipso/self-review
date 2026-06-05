---
schema_version: 1
id: map-user-and-project-yaml-configuration
title: User and project YAML configuration
kind: map
tags:
  - config
  - yaml
  - files
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  User config at ~/.config/self-review/config.yaml; project config at
  .self-review.yaml in the repo root.
---
Two configuration scopes:

- **User-level**: `~/.config/self-review/config.yaml` — personal preferences across all repos (theme, diff-view, font-size, output-file, etc.).
- **Project-level**: `.self-review.yaml` in the repo root — per-project settings shared with the repo and committable (`ignore` patterns, `categories`, `default-diff-args`, etc.).

Project overrides user; CLI flags override project; built-in defaults are last. Categories defined in the project YAML drive the per-comment category selector in the UI.
