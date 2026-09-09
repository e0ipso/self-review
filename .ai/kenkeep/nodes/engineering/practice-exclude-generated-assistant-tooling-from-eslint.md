---
type: practice
title: Exclude generated assistant tooling from ESLint
description: Ignore bundled assistant tooling directories in ESLint.
tags:
  - lint
  - tooling
kk_schema_version: 3
kk_id: practice-exclude-generated-assistant-tooling-from-eslint
kk_derived_from:
  - .ai/kenkeep/_sessions/20260605-1109-549df86a-a0e7-445e-b9f7-06a3caf757f4.md
kk_relates_to:
  - map-self-review
kk_depends_on: []
kk_confidence: high
---
Keep generated assistant tooling under .codex, .claude, .cursor, .opencode and .ai outside application ESLint scans. Bundled hooks can contain inline rule directives for plugins the application does not install.

<!-- kk:citations:start -->
# Citations

[1] [.ai/kenkeep/_sessions/20260605-1109-549df86a-a0e7-445e-b9f7-06a3caf757f4.md](../../_sessions/20260605-1109-549df86a-a0e7-445e-b9f7-06a3caf757f4.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-self-review](../app/map-self-review.md)
<!-- kk:related:end -->
