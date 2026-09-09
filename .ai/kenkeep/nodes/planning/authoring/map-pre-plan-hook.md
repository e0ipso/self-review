---
type: map
title: PRE_PLAN hook
description: >-
  Pre-planning hook that establishes scope control, simplicity principles, and
  PRD-only output before plan creation.
tags:
  - strikethroo
  - hooks
  - workflow
kk_schema_version: 3
kk_id: map-pre-plan-hook
kk_derived_from:
  - .ai/strikethroo/config/hooks/PRE_PLAN.md
kk_relates_to:
  - map-post-plan-hook
  - practice-check-plans-for-architecture-and-code-reuse-improvements
  - practice-review-plans-against-prd-and-test-features-updates
  - practice-write-prds-without-tasks-or-phases-during-plan-creation
kk_depends_on: []
kk_confidence: medium
---
The PRE_PLAN hook lives at `.ai/strikethroo/config/hooks/PRE_PLAN.md`. It is fired before comprehensive plan creation to inject guidance on scope control (YAGNI, minimal viable implementation, no unrequested BC), simplicity principles (simple over clever, standard patterns, minimal dependencies), and workflow boundaries (PRD only, no tasks/phases yet).

It references the plan template at `.ai/strikethroo/config/templates/PLAN_TEMPLATE.md` as the structural source of truth for plan output.

<!-- kk:citations:start -->
# Citations

[1] [.ai/strikethroo/config/hooks/PRE_PLAN.md](../../../../strikethroo/config/hooks/PRE_PLAN.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-post-plan-hook](map-post-plan-hook.md)
- Related: [practice-check-plans-for-architecture-and-code-reuse-improvements](practice-check-plans-for-architecture-and-code-reuse-improvements.md)
- Related: [practice-review-plans-against-prd-and-test-features-updates](practice-review-plans-against-prd-and-test-features-updates.md)
- Related: [practice-write-prds-without-tasks-or-phases-during-plan-creation](practice-write-prds-without-tasks-or-phases-during-plan-creation.md)
<!-- kk:related:end -->
