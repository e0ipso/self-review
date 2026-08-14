---
type: practice
title: Never write to stdout in the main process
description: >-
  Use console.error() for logging in the main process; stdout is unused and
  reserved.
tags:
  - task-manager
  - logging
  - stdout
kk_schema_version: 3
kk_id: practice-never-write-to-stdout-in-the-main-process
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The Electron main process must never write to stdout. All logging goes to stderr via `console.error()`. The XML review output is written to a file (default `./review.xml`), not piped through stdout.

**Why:** The CLI workflow writes review output to a file, so stdout has no defined consumer. Mixing logs into stdout would corrupt the contract.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
