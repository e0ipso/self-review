---
type: map
title: POST_TASK_GENERATION_ALL hook
description: >-
  Lifecycle hook that runs after all tasks are generated to review complexity
  and append a blueprint to the plan.
tags:
  - task-management
  - hooks
  - lifecycle
kk_schema_version: 3
kk_id: map-post-task-generation-all-hook
kk_derived_from:
  - .ai/task-manager/config/hooks/POST_TASK_GENERATION_ALL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The `POST_TASK_GENERATION_ALL` hook fires after all tasks have been generated. It defines two steps: (1) review each generated task for complexity, vagueness, or triviality, and (2) update the plan document with a dependency diagram (Mermaid `graph TD`) and execution phases.

Location: `.ai/task-manager/config/hooks/POST_TASK_GENERATION_ALL.md`. The blueprint structure references the template at `.ai/task-manager/config/templates/BLUEPRINT_TEMPLATE.md`.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/hooks/POST_TASK_GENERATION_ALL.md](.ai/task-manager/config/hooks/POST_TASK_GENERATION_ALL.md)
<!-- kk:citations:end -->
