---
type: practice
title: Keep all @self-review/types definitions in src/index.ts
description: 'At current scale, all types live in src/index.ts with no subdirectories.'
tags:
  - types
  - structure
  - layout
kk_schema_version: 3
kk_id: practice-keep-all-self-review-types-definitions-in-src-index-ts
kk_derived_from:
  - packages/types/AGENTS.md
kk_relates_to:
  - map-self-review-types-package
kk_depends_on: []
kk_confidence: medium
---
The types package keeps a flat structure: all type definitions go in `src/index.ts`. No subdirectories are needed at the current scale.

<!-- kk:citations:start -->
# Citations

[1] [packages/types/AGENTS.md](../../../../../packages/types/AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-self-review-types-package](map-self-review-types-package.md)
<!-- kk:related:end -->
