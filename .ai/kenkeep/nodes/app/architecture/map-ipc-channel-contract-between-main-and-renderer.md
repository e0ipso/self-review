---
type: map
title: IPC channel contract between main and renderer
description: >-
  Named channels including diff:load, review:submit, resume:load, config:load,
  app:close-requested, app:save-and-quit, app:discard-and-quit.
tags:
  - ipc
  - channels
kk_schema_version: 3
kk_id: map-ipc-channel-contract-between-main-and-renderer
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Main ↔ renderer communication uses Electron's ipcMain/ipcRenderer bridge over named channels. Core channels:

- `diff:load` (Main → Renderer): parsed diff data on startup
- `review:submit` (Renderer → Main): complete review state on window close
- `resume:load` (Main → Renderer): prior review state from XML for --resume-from
- `config:load` (Main → Renderer): merged configuration (theme, view mode, categories)
- `app:close-requested` (Main → Renderer): user tried to close the window
- `app:save-and-quit` / `app:discard-and-quit` (Renderer → Main): user's choice from the close dialog
- `diff:load-file` (Renderer → Main): per-file hunk fetch in large-payload mode

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
