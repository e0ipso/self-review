---
type: practice
title: Do not import sibling packages from @self-review/types
description: >-
  The types package is a leaf dependency and must never import from
  @self-review/core or @self-review/react.
tags:
  - types
  - imports
  - architecture
kk_schema_version: 3
kk_id: practice-do-not-import-sibling-packages-from-self-review-types
kk_derived_from:
  - packages/types/AGENTS.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`@self-review/types` sits at the bottom of the dependency graph. It must never import from `@self-review/core` or `@self-review/react`.

This keeps it usable as a shared contract that both sibling packages and the Electron app can depend on without creating cycles.

<!-- kk:citations:start -->
# Citations

[1] [packages/types/AGENTS.md](packages/types/AGENTS.md)
<!-- kk:citations:end -->
