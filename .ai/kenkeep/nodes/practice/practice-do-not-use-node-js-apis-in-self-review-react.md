---
schema_version: 1
id: practice-do-not-use-node-js-apis-in-self-review-react
title: Do not use Node.js APIs in @self-review/react
kind: practice
tags:
  - react
  - browser
  - constraints
derived_from:
  - packages/react/AGENTS.md
relates_to: []
confidence: high
summary: 'The react package is browser-only; no fs, child_process, or path imports.'
---
`@self-review/react` runs in renderer processes and browser environments. Do not import Node.js APIs such as `fs`, `child_process`, or `path` from this package.

This constraint exists because the package is consumed both by the Electron renderer and by the webapp e2e test harness, neither of which has Node runtime access in the contexts where these components render.
