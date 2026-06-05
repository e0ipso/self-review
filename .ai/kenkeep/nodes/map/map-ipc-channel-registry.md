---
schema_version: 1
id: map-ipc-channel-registry
title: IPC channel registry
kind: map
tags:
  - task-manager
  - ipc
  - channels
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  Channels defined in src/shared/ipc-channels.ts cover diff loading, review
  submission, resume, config, output path, and lifecycle events.
---
All IPC channels are defined as constants in `src/shared/ipc-channels.ts`, imported by both main and renderer. Key channels include:

- `diff:load` — main → renderer, sends parsed `DiffFile[]`
- `review:submit` — renderer → main, collects `ReviewState` on close
- `resume:load` — main → renderer, loads prior comments for `--resume-from`
- `config:load` — main → renderer, sends merged `AppConfig`
- `app:close-requested`, `app:save-and-quit`, `app:discard-and-quit` — window lifecycle
- `diff:expand-context`, `diff:load-file`, `diff:load-image` — on-demand diff/image loading
- `output-path:change`, `output-path:changed` — runtime output path changes
- `version-update:available` — startup version-check result
- `open-external` — open URL in default browser
