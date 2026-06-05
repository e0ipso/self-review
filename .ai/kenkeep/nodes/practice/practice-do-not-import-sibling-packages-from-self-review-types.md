---
schema_version: 1
id: practice-do-not-import-sibling-packages-from-self-review-types
title: Do not import sibling packages from @self-review/types
kind: practice
tags:
  - types
  - imports
  - architecture
derived_from:
  - packages/types/AGENTS.md
relates_to: []
confidence: high
summary: >-
  The types package is a leaf dependency and must never import from
  @self-review/core or @self-review/react.
---
`@self-review/types` sits at the bottom of the dependency graph. It must never import from `@self-review/core` or `@self-review/react`.

This keeps it usable as a shared contract that both sibling packages and the Electron app can depend on without creating cycles.
