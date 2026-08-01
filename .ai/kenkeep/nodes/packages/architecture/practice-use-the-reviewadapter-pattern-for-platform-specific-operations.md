---
type: practice
title: Use the ReviewAdapter pattern for platform-specific operations
description: >-
  Abstract expand-context, image loading, and output-path changes via
  ReviewAdapter.
tags:
  - architecture
  - adapter
  - platform
kk_schema_version: 3
kk_id: practice-use-the-reviewadapter-pattern-for-platform-specific-operations
kk_derived_from:
  - packages/react/AGENTS.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Platform-specific operations such as expand context, load images, and change output path must go through the `ReviewAdapter` interface. The Electron app and the webapp e2e harness each provide their own adapter implementation.

This keeps `@self-review/react` decoupled from any specific host environment.

<!-- kk:citations:start -->
# Citations

[1] [packages/react/AGENTS.md](packages/react/AGENTS.md)
<!-- kk:citations:end -->
