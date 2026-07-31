---
type: map
title: ReviewAdapter interface
description: Abstraction for platform-specific operations defined in src/adapter.ts.
tags:
  - interface
  - adapter
  - platform
kk_schema_version: 3
kk_id: map-reviewadapter-interface
kk_derived_from:
  - packages/react/AGENTS.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`ReviewAdapter` (declared in `packages/react/src/adapter.ts`) is the interface that abstracts platform-specific operations: expand context, load images, change output path. The Electron app and the webapp e2e harness each implement this interface to plug into the shared UI.

<!-- kk:citations:start -->
# Citations

[1] [packages/react/AGENTS.md](packages/react/AGENTS.md)
<!-- kk:citations:end -->
