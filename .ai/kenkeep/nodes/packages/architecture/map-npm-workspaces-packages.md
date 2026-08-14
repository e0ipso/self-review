---
type: map
title: npm workspaces packages
description: >-
  Reusable packages: @self-review/core (logic), @self-review/react (UI),
  @self-review/types (shared types).
tags:
  - task-manager
  - packages
  - workspaces
kk_schema_version: 3
kk_id: map-npm-workspaces-packages
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The project uses npm workspaces to manage reusable packages under `packages/*`:

- `@self-review/core` — headless diff parsing and review logic
- `@self-review/react` — React components for the review UI
- `@self-review/types` — shared TypeScript interfaces (zero runtime deps)

The Electron app imports these packages via relative path imports to their source, not through workspace symlinks, so no build step is needed for the packages during development. `src/shared/types.ts` re-exports from `packages/types/src/index` as the canonical type source.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
