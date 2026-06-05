---
schema_version: 1
id: practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react
title: Keep file-type-utils.ts duplicates in sync across core and react
kind: practice
tags:
  - duplication
  - sync
  - utils
derived_from:
  - packages/react/AGENTS.md
relates_to: []
confidence: high
summary: The file is intentionally duplicated; both copies must be updated together.
---
`src/utils/file-type-utils.ts` in `@self-review/react` is an intentional copy of `packages/core/src/file-type-utils.ts`. The duplication exists because the react package cannot import from core (which has Node-only dependencies).

When changing one copy, update the other. See the comment in the file for full rationale.
