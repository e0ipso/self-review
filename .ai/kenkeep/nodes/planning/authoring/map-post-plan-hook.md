---
type: map
title: POST_PLAN hook
description: >-
  Task-manager hook at .ai/task-manager/config/hooks/POST_PLAN.md that gates
  plans on PRD/test updates and architecture review.
tags:
  - hooks
  - task-manager
  - planning
kk_schema_version: 3
kk_id: map-post-plan-hook
kk_derived_from:
  - .ai/task-manager/config/hooks/POST_PLAN.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`POST_PLAN` is a hook defined at `.ai/task-manager/config/hooks/POST_PLAN.md` in the task-manager config. It runs after a plan is produced and poses checklist questions about whether the plan updates `PRD.md` and `test/features`, and whether it identifies architecture and code reuse improvements in its areas of influence.

The hook instructs the assistant to update the plan if either check fails.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/hooks/POST_PLAN.md](.ai/task-manager/config/hooks/POST_PLAN.md)
<!-- kk:citations:end -->
