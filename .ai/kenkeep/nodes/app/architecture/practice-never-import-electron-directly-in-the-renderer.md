---
type: practice
title: Never import electron directly in the renderer
description: >-
  Renderer must only access IPC via the preload contextBridge electronAPI object.
tags:
  - strikethroo
  - ipc
  - security
kk_schema_version: 3
kk_id: practice-never-import-electron-directly-in-the-renderer
kk_derived_from:
  - AGENTS.md
kk_relates_to:
  - map-two-process-electron-architecture
  - map-ipc-channel-registry
kk_depends_on: []
kk_confidence: high
---
The preload script uses `contextBridge.exposeInMainWorld` to expose a typed `electronAPI` object. The renderer NEVER imports from `electron` directly. Do not use `nodeIntegration: true`; always go through the preload script.

**Why:** Standard Electron security model — keeps the renderer sandboxed and prevents arbitrary Node access from web content.

<!-- kk:citations:start -->
# Citations

[1] [AGENTS.md](../../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-two-process-electron-architecture](map-two-process-electron-architecture.md)
- Related: [map-ipc-channel-registry](map-ipc-channel-registry.md)
<!-- kk:related:end -->
