---
schema_version: 1
id: practice-never-import-electron-directly-in-the-renderer
title: Never import electron directly in the renderer
kind: practice
tags:
  - task-manager
  - ipc
  - security
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  Renderer must only access IPC via the preload contextBridge electronAPI
  object.
---
The preload script uses `contextBridge.exposeInMainWorld` to expose a typed `electronAPI` object. The renderer NEVER imports from `electron` directly. Do not use `nodeIntegration: true`; always go through the preload script.

**Why:** Standard Electron security model — keeps the renderer sandboxed and prevents arbitrary Node access from web content.
