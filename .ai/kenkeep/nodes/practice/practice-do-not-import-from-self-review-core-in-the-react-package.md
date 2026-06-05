---
schema_version: 1
id: practice-do-not-import-from-self-review-core-in-the-react-package
title: Do not import from @self-review/core in the react package
kind: practice
tags:
  - react
  - imports
  - bundling
derived_from:
  - packages/react/AGENTS.md
relates_to: []
confidence: high
summary: Importing core risks pulling Node-only code into the browser bundle.
---
Never import from `@self-review/core` inside `@self-review/react`, even a single function. Core has Node-only dependencies, and any import risks pulling Node code into the browser bundle.

For shared type definitions, use `@self-review/types` instead.
