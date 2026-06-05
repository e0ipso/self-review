---
schema_version: 1
id: map-ipc-channel-contract-between-main-and-renderer
title: IPC channel contract between main and renderer
kind: map
tags:
  - ipc
  - channels
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  Named channels including diff:load, review:submit, resume:load, config:load,
  app:close-requested, app:save-and-quit, app:discard-and-quit.
---
Main ↔ renderer communication uses Electron's ipcMain/ipcRenderer bridge over named channels. Core channels:

- `diff:load` (Main → Renderer): parsed diff data on startup
- `review:submit` (Renderer → Main): complete review state on window close
- `resume:load` (Main → Renderer): prior review state from XML for --resume-from
- `config:load` (Main → Renderer): merged configuration (theme, view mode, categories)
- `app:close-requested` (Main → Renderer): user tried to close the window
- `app:save-and-quit` / `app:discard-and-quit` (Renderer → Main): user's choice from the close dialog
- `diff:load-file` (Renderer → Main): per-file hunk fetch in large-payload mode
