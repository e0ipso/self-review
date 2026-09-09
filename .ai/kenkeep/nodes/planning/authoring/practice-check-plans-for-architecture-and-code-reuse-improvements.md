---
type: practice
title: Keep architecture decisions within the requested plan scope
description: >-
  Use PRE_PLAN simplicity and scope rules when evaluating abstractions.
tags:
  - planning
  - architecture
  - code-reuse
kk_schema_version: 3
kk_id: practice-check-plans-for-architecture-and-code-reuse-improvements
kk_derived_from:
  - .ai/strikethroo/config/hooks/POST_PLAN.md
  - .ai/strikethroo/config/hooks/PRE_PLAN.md
kk_relates_to:
  - map-pre-plan-hook
kk_depends_on: []
kk_confidence: high
---
Apply the PRE_PLAN scope and simplicity rules when considering architecture or shared code. Prefer the simplest maintainable solution that meets the request. The current POST_PLAN hook checks self-validation and documentation needs; it does not require speculative architecture improvements.

<!-- kk:citations:start -->
# Citations

[1] [.ai/strikethroo/config/hooks/POST_PLAN.md](../../../../strikethroo/config/hooks/POST_PLAN.md)
[2] [.ai/strikethroo/config/hooks/PRE_PLAN.md](../../../../strikethroo/config/hooks/PRE_PLAN.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-pre-plan-hook](map-pre-plan-hook.md)
<!-- kk:related:end -->
