---
type: practice
title: Never import electron directly in the renderer
description: >-
  Renderer must only access IPC via the preload contextBridge electronAPI
  object.
tags:
  - task-manager
  - ipc
  - security
kk_schema_version: 3
kk_id: practice-never-import-electron-directly-in-the-renderer
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The preload script uses `contextBridge.exposeInMainWorld` to expose a typed `electronAPI` object. The renderer NEVER imports from `electron` directly. Do not use `nodeIntegration: true`; always go through the preload script.

**Why:** Standard Electron security model — keeps the renderer sandboxed and prevents arbitrary Node access from web content.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
