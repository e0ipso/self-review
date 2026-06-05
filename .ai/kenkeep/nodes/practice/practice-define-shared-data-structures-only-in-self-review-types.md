---
schema_version: 1
id: practice-define-shared-data-structures-only-in-self-review-types
title: Define shared data structures only in @self-review/types
kind: practice
tags:
  - types
  - single-source
  - shared
derived_from:
  - packages/types/AGENTS.md
relates_to: []
confidence: high
summary: >-
  Use @self-review/types as the single source of truth for data structures
  shared across packages and the Electron app.
---
All cross-package data structures live in `@self-review/types`. Both `@self-review/core` and `@self-review/react` depend on it, and the Electron app's `src/shared/types.ts` re-exports from it.

Do not duplicate type definitions in consumer packages; import or re-export from this package instead.
