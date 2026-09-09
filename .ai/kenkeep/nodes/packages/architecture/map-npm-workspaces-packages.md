---
type: map
title: npm workspaces packages
description: >-
  Reusable packages: @self-review/core (logic), @self-review/react (UI),
  @self-review/types (shared types).
tags:
  - strikethroo
  - packages
  - workspace
kk_schema_version: 3
kk_id: map-npm-workspaces-packages
kk_derived_from:
  - AGENTS.md
kk_relates_to:
  - map-self-review-react-package
  - map-self-review-types-package
  - practice-do-not-import-from-self-review-core-in-the-react-package
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

[1] [AGENTS.md](../../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-self-review-react-package](map-self-review-react-package.md)
- Related: [map-self-review-types-package](../types/map-self-review-types-package.md)
- Related: [practice-do-not-import-from-self-review-core-in-the-react-package](practice-do-not-import-from-self-review-core-in-the-react-package.md)
<!-- kk:related:end -->
