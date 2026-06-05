---
schema_version: 1
id: map-post-task-generation-all-hook
title: POST_TASK_GENERATION_ALL hook
kind: map
tags:
  - task-management
  - hooks
  - lifecycle
derived_from:
  - .ai/task-manager/config/hooks/POST_TASK_GENERATION_ALL.md
relates_to: []
confidence: high
summary: >-
  Lifecycle hook that runs after all tasks are generated to review complexity
  and append a blueprint to the plan.
---
The `POST_TASK_GENERATION_ALL` hook fires after all tasks have been generated. It defines two steps: (1) review each generated task for complexity, vagueness, or triviality, and (2) update the plan document with a dependency diagram (Mermaid `graph TD`) and execution phases.

Location: `.ai/task-manager/config/hooks/POST_TASK_GENERATION_ALL.md`. The blueprint structure references the template at `.ai/task-manager/config/templates/BLUEPRINT_TEMPLATE.md`.
