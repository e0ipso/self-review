---
schema_version: 1
id: map-self-review-types-package
title: '@self-review/types package'
kind: map
tags:
  - package
  - types
  - workspace
derived_from:
  - packages/types/AGENTS.md
relates_to: []
confidence: high
summary: >-
  Shared TypeScript type definitions for the self-review workspace, with zero
  runtime dependencies.
---
`@self-review/types` is a workspace package providing the single source of truth for data structures shared across packages and the Electron app.

Consumers: `@self-review/core` and `@self-review/react` depend on it directly, and the Electron app's `src/shared/types.ts` re-exports from it.

Location: `packages/types/`, with all type definitions in `src/index.ts`.
