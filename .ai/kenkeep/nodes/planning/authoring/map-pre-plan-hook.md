---
type: map
title: PRE_PLAN hook
description: >-
  Pre-planning hook that establishes scope control, simplicity principles, and
  PRD-only output before plan creation.
tags:
  - task-manager
  - hook
  - workflow
kk_schema_version: 3
kk_id: map-pre-plan-hook
kk_derived_from:
  - .ai/task-manager/config/hooks/PRE_PLAN.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: medium
---
The PRE_PLAN hook lives at `.ai/task-manager/config/hooks/PRE_PLAN.md`. It is fired before comprehensive plan creation to inject guidance on scope control (YAGNI, minimal viable implementation, no unrequested BC), simplicity principles (simple over clever, standard patterns, minimal dependencies), and workflow boundaries (PRD only, no tasks/phases yet).

It references the plan template at `.ai/task-manager/config/templates/PLAN_TEMPLATE.md` as the structural source of truth for plan output.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/hooks/PRE_PLAN.md](.ai/task-manager/config/hooks/PRE_PLAN.md)
<!-- kk:citations:end -->
