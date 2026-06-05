---
schema_version: 1
id: map-two-process-electron-architecture
title: Two-process Electron architecture
kind: map
tags:
  - task-manager
  - architecture
  - electron
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  Main process runs CLI/git/IPC/file I/O; renderer is a React + TypeScript UI
  sandboxed via preload contextBridge.
---
The app uses Electron's two-process model. The **main process** parses CLI args, runs `git diff`, parses the unified diff into a structured AST (`DiffFile[]`), and sends it to the renderer via IPC. On 'Finish Review' or 'Save & Quit', it collects review state from the renderer, serializes it to XML, writes to the output file, and exits.

The **renderer process** is a React app that renders the review UI and manages all review state (comments, suggestions, viewed flags) in React context. It communicates with main via the preload bridge, which uses `contextBridge.exposeInMainWorld` to expose a typed `electronAPI` object.
