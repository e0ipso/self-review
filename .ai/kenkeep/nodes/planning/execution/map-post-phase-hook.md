---
type: map
title: POST_PHASE hook
description: >-
  Task-manager hook that runs after each phase to enforce linting, conventional
  commits, and blueprint progress updates.
tags:
  - hook
  - workflow
  - task-manager
kk_schema_version: 3
kk_id: map-post-phase-hook
kk_derived_from:
  - .ai/task-manager/config/hooks/POST_PHASE.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The POST_PHASE hook is defined at `.ai/task-manager/config/hooks/POST_PHASE.md`. It runs at the end of each phase in the task-manager workflow and enforces two gating conditions: the codebase passes linting, and a descriptive conventional commit (subject + description) has been created for the phase.

It also defines execution-monitoring behavior: updating the plan/blueprint with phase (✅) and task (✔️) completion markers, and the allowed task status transitions (`pending`, `in-progress`, `completed`, `failed`).

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/hooks/POST_PHASE.md](.ai/task-manager/config/hooks/POST_PHASE.md)
<!-- kk:citations:end -->
