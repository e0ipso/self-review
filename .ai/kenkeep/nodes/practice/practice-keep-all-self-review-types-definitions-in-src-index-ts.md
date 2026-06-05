---
schema_version: 1
id: practice-keep-all-self-review-types-definitions-in-src-index-ts
title: Keep all @self-review/types definitions in src/index.ts
kind: practice
tags:
  - types
  - structure
  - layout
derived_from:
  - packages/types/AGENTS.md
relates_to: []
confidence: medium
summary: 'At current scale, all types live in src/index.ts with no subdirectories.'
---
The types package keeps a flat structure: all type definitions go in `src/index.ts`. No subdirectories are needed at the current scale.
