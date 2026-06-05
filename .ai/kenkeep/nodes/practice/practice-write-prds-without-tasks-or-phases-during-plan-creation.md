---
schema_version: 1
id: practice-write-prds-without-tasks-or-phases-during-plan-creation
title: Write PRDs without tasks or phases during plan creation
kind: practice
tags:
  - planning
  - prd
  - workflow
derived_from:
  - .ai/task-manager/config/hooks/PRE_PLAN.md
relates_to: []
confidence: high
summary: >-
  Plan creation produces the PRD only. Tasks and phases are generated in a later
  workflow step.
---
During comprehensive plan creation, stick to writing the PRD (Project Requirements Document). Do not create or list any tasks or phases at this stage — that is handled in a later step of the task-manager workflow.

Prioritize accuracy over speed, and never generate a partial or assumed plan without adequate context. Consider both technical and non-technical aspects.

**How to apply:** When invoked via the PRE_PLAN hook or plan-creation flow, use the template at `.ai/task-manager/config/templates/PLAN_TEMPLATE.md` and emit only PRD content.
