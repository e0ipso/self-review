---
type: practice
title: Write PRDs without tasks or phases during plan creation
description: >-
  Plan creation produces the PRD only. Tasks and phases are generated in a later
  workflow step.
tags:
  - planning
  - prd
  - workflow
kk_schema_version: 3
kk_id: practice-write-prds-without-tasks-or-phases-during-plan-creation
kk_derived_from:
  - .ai/strikethroo/config/hooks/PRE_PLAN.md
kk_relates_to:
  - map-pre-plan-hook
kk_depends_on: []
kk_confidence: high
---
During comprehensive plan creation, stick to writing the PRD (Project Requirements Document). Do not create or list any tasks or phases at this stage — that is handled in a later step of the task-manager workflow.

Prioritize accuracy over speed, and never generate a partial or assumed plan without adequate context. Consider both technical and non-technical aspects.

**How to apply:** When invoked via the PRE_PLAN hook or plan-creation flow, use the template at `.ai/strikethroo/config/templates/PLAN_TEMPLATE.md` and emit only PRD content.

<!-- kk:citations:start -->
# Citations

[1] [.ai/strikethroo/config/hooks/PRE_PLAN.md](../../../../strikethroo/config/hooks/PRE_PLAN.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-pre-plan-hook](map-pre-plan-hook.md)
<!-- kk:related:end -->
