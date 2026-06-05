---
schema_version: 1
id: map-post-phase-hook
title: POST_PHASE hook
kind: map
tags:
  - hook
  - workflow
  - task-manager
derived_from:
  - .ai/task-manager/config/hooks/POST_PHASE.md
relates_to: []
confidence: high
summary: >-
  Task-manager hook that runs after each phase to enforce linting, conventional
  commits, and blueprint progress updates.
---
The POST_PHASE hook is defined at `.ai/task-manager/config/hooks/POST_PHASE.md`. It runs at the end of each phase in the task-manager workflow and enforces two gating conditions: the codebase passes linting, and a descriptive conventional commit (subject + description) has been created for the phase.

It also defines execution-monitoring behavior: updating the plan/blueprint with phase (✅) and task (✔️) completion markers, and the allowed task status transitions (`pending`, `in-progress`, `completed`, `failed`).
