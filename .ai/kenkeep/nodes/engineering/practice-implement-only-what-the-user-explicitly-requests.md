---
type: practice
title: Implement only what the user explicitly requests
description: >-
  Build the minimal viable solution. Don't add features, abstractions, or
  backwards compatibility unless asked.
tags:
  - scope
  - planning
  - yagni
kk_schema_version: 3
kk_id: practice-implement-only-what-the-user-explicitly-requests
kk_derived_from:
  - .ai/task-manager/config/hooks/PRE_PLAN.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
When creating plans or implementations, build exactly what the user asked for and nothing more. Question every addition: if it's not directly mentioned in the user's request, don't add it.

Avoid common scope creep anti-patterns: extra commands "for completeness," infrastructure for hypothetical future features, abstractions when simple solutions suffice, configuration options not requested, error handling beyond the core request, and documentation/help systems unless explicitly requested.

Do not add backwards compatibility unless requested. If a potential BC break exists, ask the user whether they want BC support rather than assuming.

When in doubt, ask: "Is this feature explicitly mentioned in the user's request?"

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/hooks/PRE_PLAN.md](.ai/task-manager/config/hooks/PRE_PLAN.md)
<!-- kk:citations:end -->
