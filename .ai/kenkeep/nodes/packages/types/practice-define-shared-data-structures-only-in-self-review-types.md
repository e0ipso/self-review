---
type: practice
title: Define shared data structures only in @self-review/types
description: >-
  Use @self-review/types as the single source of truth for data structures
  shared across packages and the Electron app.
tags:
  - types
  - single-source
  - shared
kk_schema_version: 3
kk_id: practice-define-shared-data-structures-only-in-self-review-types
kk_derived_from:
  - packages/types/AGENTS.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
All cross-package data structures live in `@self-review/types`. Both `@self-review/core` and `@self-review/react` depend on it, and the Electron app's `src/shared/types.ts` re-exports from it.

Do not duplicate type definitions in consumer packages; import or re-export from this package instead.

<!-- kk:citations:start -->
# Citations

[1] [packages/types/AGENTS.md](packages/types/AGENTS.md)
<!-- kk:citations:end -->
