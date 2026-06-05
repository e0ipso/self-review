---
schema_version: 1
id: practice-use-the-reviewadapter-pattern-for-platform-specific-operations
title: Use the ReviewAdapter pattern for platform-specific operations
kind: practice
tags:
  - architecture
  - adapter
  - platform
derived_from:
  - packages/react/AGENTS.md
relates_to: []
confidence: high
summary: >-
  Abstract expand-context, image loading, and output-path changes via
  ReviewAdapter.
---
Platform-specific operations such as expand context, load images, and change output path must go through the `ReviewAdapter` interface. The Electron app and the webapp e2e harness each provide their own adapter implementation.

This keeps `@self-review/react` decoupled from any specific host environment.
