---
type: map
title: User and project YAML configuration
description: >-
  User config at ~/.config/self-review/config.yaml; project config at
  .self-review.yaml in the repo root.
tags:
  - config
  - yaml
  - files
kk_schema_version: 3
kk_id: map-user-and-project-yaml-configuration
kk_derived_from:
  - docs/PRD.md
kk_relates_to:
  - map-self-review-yaml-configuration-options
  - map-self-review-yaml-project-config
  - practice-apply-config-precedence-cli-project-yaml-user-yaml-defaults
  - practice-apply-config-precedence-project-overrides-user-overrides-defaults
kk_depends_on: []
kk_confidence: high
---
Two configuration scopes:

- **User-level**: `~/.config/self-review/config.yaml` — personal preferences across all repos (theme, diff-view, font-size, output-file, etc.).
- **Project-level**: `.self-review.yaml` in the repo root — per-project settings shared with the repo and committable (`ignore` patterns, `categories`, `default-diff-args`, etc.).

Project overrides user; CLI flags override project; built-in defaults are last. Categories defined in the project YAML drive the per-comment category selector in the UI.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](../../../../../docs/PRD.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-self-review-yaml-configuration-options](map-self-review-yaml-configuration-options.md)
- Related: [map-self-review-yaml-project-config](map-self-review-yaml-project-config.md)
- Related: [practice-apply-config-precedence-cli-project-yaml-user-yaml-defaults](practice-apply-config-precedence-cli-project-yaml-user-yaml-defaults.md)
- Related: [practice-apply-config-precedence-project-overrides-user-overrides-defaults](practice-apply-config-precedence-project-overrides-user-overrides-defaults.md)
<!-- kk:related:end -->
