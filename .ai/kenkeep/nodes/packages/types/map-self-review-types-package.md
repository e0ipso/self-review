---
type: map
title: '@self-review/types package'
description: >-
  Shared TypeScript type definitions for the self-review workspace, with zero
  runtime dependencies.
tags:
  - packages
  - types
  - workspace
kk_schema_version: 3
kk_id: map-self-review-types-package
kk_derived_from:
  - packages/types/AGENTS.md
kk_relates_to:
  - practice-define-shared-data-structures-only-in-self-review-types
  - practice-do-not-import-sibling-packages-from-self-review-types
  - practice-keep-all-self-review-types-definitions-in-src-index-ts
  - practice-keep-self-review-types-free-of-runtime-dependencies
  - map-npm-workspaces-packages
kk_depends_on: []
kk_confidence: high
---
`@self-review/types` is a workspace package providing the single source of truth for data structures shared across packages and the Electron app.

Consumers: `@self-review/core` and `@self-review/react` depend on it directly, and the Electron app's `src/shared/types.ts` re-exports from it.

Location: `packages/types/`, with all type definitions in `src/index.ts`.

<!-- kk:citations:start -->
# Citations

[1] [packages/types/AGENTS.md](../../../../../packages/types/AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [practice-define-shared-data-structures-only-in-self-review-types](practice-define-shared-data-structures-only-in-self-review-types.md)
- Related: [practice-do-not-import-sibling-packages-from-self-review-types](practice-do-not-import-sibling-packages-from-self-review-types.md)
- Related: [practice-keep-all-self-review-types-definitions-in-src-index-ts](practice-keep-all-self-review-types-definitions-in-src-index-ts.md)
- Related: [practice-keep-self-review-types-free-of-runtime-dependencies](practice-keep-self-review-types-free-of-runtime-dependencies.md)
- Related: [map-npm-workspaces-packages](../architecture/map-npm-workspaces-packages.md)
<!-- kk:related:end -->
