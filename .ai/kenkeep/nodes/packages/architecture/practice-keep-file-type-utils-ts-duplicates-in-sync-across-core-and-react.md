---
type: practice
title: Keep file-type-utils.ts duplicates in sync across core and react
description: The file is intentionally duplicated; both copies must be updated together.
tags:
  - duplication
  - sync
  - utils
kk_schema_version: 3
kk_id: practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react
kk_derived_from:
  - packages/react/AGENTS.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`src/utils/file-type-utils.ts` in `@self-review/react` is an intentional copy of `packages/core/src/file-type-utils.ts`. The duplication exists because the react package cannot import from core (which has Node-only dependencies).

When changing one copy, update the other. See the comment in the file for full rationale.

<!-- kk:citations:start -->
# Citations

[1] [packages/react/AGENTS.md](packages/react/AGENTS.md)
<!-- kk:citations:end -->
