---
schema_version: 1
id: practice-keep-self-review-types-free-of-runtime-dependencies
title: Keep @self-review/types free of runtime dependencies
kind: practice
tags:
  - types
  - dependencies
  - package
derived_from:
  - packages/types/AGENTS.md
relates_to: []
confidence: high
summary: >-
  The types package must never add runtime dependencies in package.json; it
  exists solely for type exports.
---
`@self-review/types` is a pure type-only package. Never add runtime `dependencies` to its `package.json`.

It must not emit JavaScript: no runtime code, no utility functions, no constants. If it would emit JS, it does not belong in this package.
