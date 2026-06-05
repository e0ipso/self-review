---
schema_version: 1
id: map-reviewadapter-interface
title: ReviewAdapter interface
kind: map
tags:
  - interface
  - adapter
  - platform
derived_from:
  - packages/react/AGENTS.md
relates_to: []
confidence: high
summary: Abstraction for platform-specific operations defined in src/adapter.ts.
---
`ReviewAdapter` (declared in `packages/react/src/adapter.ts`) is the interface that abstracts platform-specific operations: expand context, load images, change output path. The Electron app and the webapp e2e harness each implement this interface to plug into the shared UI.
