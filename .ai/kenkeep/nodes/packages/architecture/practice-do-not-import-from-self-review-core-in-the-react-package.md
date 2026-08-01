---
type: practice
title: Do not import from @self-review/core in the react package
description: Importing core risks pulling Node-only code into the browser bundle.
tags:
  - react
  - imports
  - bundling
kk_schema_version: 3
kk_id: practice-do-not-import-from-self-review-core-in-the-react-package
kk_derived_from:
  - packages/react/AGENTS.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Never import from `@self-review/core` inside `@self-review/react`, even a single function. Core has Node-only dependencies, and any import risks pulling Node code into the browser bundle.

For shared type definitions, use `@self-review/types` instead.

<!-- kk:citations:start -->
# Citations

[1] [packages/react/AGENTS.md](packages/react/AGENTS.md)
<!-- kk:citations:end -->
