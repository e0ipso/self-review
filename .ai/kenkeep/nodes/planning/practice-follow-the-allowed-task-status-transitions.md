---
type: practice
title: Follow the allowed task status transitions
description: >-
  Use only the defined transitions: pending→in-progress, in-progress→completed,
  in-progress→failed, failed→in-progress.
tags:
  - workflow
  - task-status
kk_schema_version: 3
kk_id: practice-follow-the-allowed-task-status-transitions
kk_derived_from:
  - .ai/task-manager/config/hooks/POST_PHASE.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Valid task status transitions are: `pending` → `in-progress` when an agent starts the task; `in-progress` → `completed` on successful execution; `in-progress` → `failed` on execution error; and `failed` → `in-progress` on a retry attempt.

Do not introduce other states or skip transitions when updating task status.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/hooks/POST_PHASE.md](.ai/task-manager/config/hooks/POST_PHASE.md)
<!-- kk:citations:end -->
