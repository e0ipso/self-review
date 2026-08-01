---
type: map
title: '@self-review/types package'
description: >-
  Shared TypeScript type definitions for the self-review workspace, with zero
  runtime dependencies.
tags:
  - package
  - types
  - workspace
kk_schema_version: 3
kk_id: map-self-review-types-package
kk_derived_from:
  - packages/types/AGENTS.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`@self-review/types` is a workspace package providing the single source of truth for data structures shared across packages and the Electron app.

Consumers: `@self-review/core` and `@self-review/react` depend on it directly, and the Electron app's `src/shared/types.ts` re-exports from it.

Location: `packages/types/`, with all type definitions in `src/index.ts`.

<!-- kk:citations:start -->
# Citations

[1] [packages/types/AGENTS.md](packages/types/AGENTS.md)
<!-- kk:citations:end -->
