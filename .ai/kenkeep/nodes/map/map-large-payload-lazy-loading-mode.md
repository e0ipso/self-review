---
schema_version: 1
id: map-large-payload-lazy-loading-mode
title: Large-payload lazy-loading mode
kind: map
tags:
  - task-manager
  - large-payload
  - perf
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  When a diff exceeds max-files or max-total-lines, files load without hunks
  initially and hunks are fetched lazily via diff:load-file.
---
When the diff exceeds configurable thresholds (`max-files` or `max-total-lines`), the main process sends file metadata without hunks in the initial `diff:load` payload. The renderer lazily requests each file's hunks via the `diff:load-file` IPC channel as the user navigates, avoiding memory pressure from loading the entire diff at once.

Payload sizing is computed in `src/main/payload-sizing.ts`.
