---
schema_version: 1
id: map-post-plan-hook
title: POST_PLAN hook
kind: map
tags:
  - hooks
  - task-manager
  - planning
derived_from:
  - .ai/task-manager/config/hooks/POST_PLAN.md
relates_to: []
confidence: high
summary: >-
  Task-manager hook at .ai/task-manager/config/hooks/POST_PLAN.md that gates
  plans on PRD/test updates and architecture review.
---
`POST_PLAN` is a hook defined at `.ai/task-manager/config/hooks/POST_PLAN.md` in the task-manager config. It runs after a plan is produced and poses checklist questions about whether the plan updates `PRD.md` and `test/features`, and whether it identifies architecture and code reuse improvements in its areas of influence.

The hook instructs the assistant to update the plan if either check fails.
