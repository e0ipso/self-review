---
type: map
title: Large-payload lazy-loading mode
description: >-
  When a diff exceeds max-files or max-total-lines, files load without hunks
  initially and hunks are fetched lazily via diff:load-file.
tags:
  - task-manager
  - large-payload
  - perf
kk_schema_version: 3
kk_id: map-large-payload-lazy-loading-mode
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
When the diff exceeds configurable thresholds (`max-files` or `max-total-lines`), the main process sends file metadata without hunks in the initial `diff:load` payload. The renderer lazily requests each file's hunks via the `diff:load-file` IPC channel as the user navigates, avoiding memory pressure from loading the entire diff at once.

Payload sizing is computed in `src/main/payload-sizing.ts`.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
