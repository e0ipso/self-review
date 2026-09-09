---
type: map
title: POST_TASK_GENERATION_ALL hook
description: >-
  Append an acyclic dependency diagram and ordered execution phases.
tags:
  - strikethroo
  - hooks
  - lifecycle
kk_schema_version: 3
kk_id: map-post-task-generation-all-hook
kk_derived_from:
  - .ai/strikethroo/config/hooks/POST_TASK_GENERATION_ALL.md
kk_relates_to:
  - practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan
  - practice-review-every-generated-task-for-complexity-vagueness-and-triviality
kk_depends_on: []
kk_confidence: high
---
The hook at `.ai/strikethroo/config/hooks/POST_TASK_GENERATION_ALL.md` appends the execution blueprint: a Mermaid dependency graph when dependencies exist, and phases ordered after their dependencies. Use `.ai/strikethroo/config/templates/BLUEPRINT_TEMPLATE.md`. Each task belongs to one phase and Phase 1 has no dependencies.

<!-- kk:citations:start -->
# Citations

[1] [.ai/strikethroo/config/hooks/POST_TASK_GENERATION_ALL.md](../../../../strikethroo/config/hooks/POST_TASK_GENERATION_ALL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan](practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan.md)
- Related: [practice-review-every-generated-task-for-complexity-vagueness-and-triviality](practice-review-every-generated-task-for-complexity-vagueness-and-triviality.md)
<!-- kk:related:end -->
