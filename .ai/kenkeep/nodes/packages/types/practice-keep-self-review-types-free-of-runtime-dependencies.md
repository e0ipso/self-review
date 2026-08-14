---
type: practice
title: Keep @self-review/types free of runtime dependencies
description: >-
  The types package must never add runtime dependencies in package.json; it
  exists solely for type exports.
tags:
  - types
  - dependencies
  - package
kk_schema_version: 3
kk_id: practice-keep-self-review-types-free-of-runtime-dependencies
kk_derived_from:
  - packages/types/AGENTS.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`@self-review/types` is a pure type-only package. Never add runtime `dependencies` to its `package.json`.

It must not emit JavaScript: no runtime code, no utility functions, no constants. If it would emit JS, it does not belong in this package.

<!-- kk:citations:start -->
# Citations

[1] [packages/types/AGENTS.md](packages/types/AGENTS.md)
<!-- kk:citations:end -->
