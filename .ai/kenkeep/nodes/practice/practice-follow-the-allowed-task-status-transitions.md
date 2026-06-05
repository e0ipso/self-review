---
schema_version: 1
id: practice-follow-the-allowed-task-status-transitions
title: Follow the allowed task status transitions
kind: practice
tags:
  - workflow
  - task-status
derived_from:
  - .ai/task-manager/config/hooks/POST_PHASE.md
relates_to: []
confidence: high
summary: >-
  Use only the defined transitions: pending→in-progress, in-progress→completed,
  in-progress→failed, failed→in-progress.
---
Valid task status transitions are: `pending` → `in-progress` when an agent starts the task; `in-progress` → `completed` on successful execution; `in-progress` → `failed` on execution error; and `failed` → `in-progress` on a retry attempt.

Do not introduce other states or skip transitions when updating task status.
