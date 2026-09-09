---
type: map
title: POST_PLAN hook
description: >-
  Require self-validation steps and decide whether docs or AGENTS.md need
  updates.
tags:
  - hooks
  - strikethroo
  - planning
kk_schema_version: 3
kk_id: map-post-plan-hook
kk_derived_from:
  - .ai/strikethroo/config/hooks/POST_PLAN.md
kk_relates_to:
  - map-pre-plan-hook
kk_depends_on: []
kk_confidence: high
---
The hook at `.ai/strikethroo/config/hooks/POST_PLAN.md` requires a Self Validation section describing how the LLM will verify completion. It also asks whether the plan needs documentation or AGENTS.md updates.

<!-- kk:citations:start -->
# Citations

[1] [.ai/strikethroo/config/hooks/POST_PLAN.md](../../../../strikethroo/config/hooks/POST_PLAN.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-pre-plan-hook](map-pre-plan-hook.md)
<!-- kk:related:end -->
