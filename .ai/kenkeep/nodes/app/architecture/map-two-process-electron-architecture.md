---
type: map
title: Two-process Electron architecture
description: >-
  Main process runs CLI/git/IPC/file I/O; renderer is a React + TypeScript UI
  sandboxed via preload contextBridge.
tags:
  - task-manager
  - architecture
  - electron
kk_schema_version: 3
kk_id: map-two-process-electron-architecture
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The app uses Electron's two-process model. The **main process** parses CLI args, runs `git diff`, parses the unified diff into a structured AST (`DiffFile[]`), and sends it to the renderer via IPC. On 'Finish Review' or 'Save & Quit', it collects review state from the renderer, serializes it to XML, writes to the output file, and exits.

The **renderer process** is a React app that renders the review UI and manages all review state (comments, suggestions, viewed flags) in React context. It communicates with main via the preload bridge, which uses `contextBridge.exposeInMainWorld` to expose a typed `electronAPI` object.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
