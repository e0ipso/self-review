---
schema_version: 1
id: map-npm-workspaces-packages
title: npm workspaces packages
kind: map
tags:
  - task-manager
  - packages
  - workspaces
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  Reusable packages: @self-review/core (logic), @self-review/react (UI),
  @self-review/types (shared types).
---
The project uses npm workspaces to manage reusable packages under `packages/*`:

- `@self-review/core` — headless diff parsing and review logic
- `@self-review/react` — React components for the review UI
- `@self-review/types` — shared TypeScript interfaces (zero runtime deps)

The Electron app imports these packages via relative path imports to their source, not through workspace symlinks, so no build step is needed for the packages during development. `src/shared/types.ts` re-exports from `packages/types/src/index` as the canonical type source.
