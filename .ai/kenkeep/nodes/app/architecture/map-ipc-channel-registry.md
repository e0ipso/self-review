---
type: map
title: IPC channel registry
description: >-
  Channels defined in src/shared/ipc-channels.ts cover diff loading, review
  submission, resume, config, output path, and lifecycle events.
tags:
  - task-manager
  - ipc
  - channels
kk_schema_version: 3
kk_id: map-ipc-channel-registry
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
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

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
