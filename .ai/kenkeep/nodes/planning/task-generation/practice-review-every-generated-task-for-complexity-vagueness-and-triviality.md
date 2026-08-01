---
type: practice
title: 'Review every generated task for complexity, vagueness, and triviality'
description: >-
  After task generation, split tasks spanning 3+ technologies/skills, sharpen
  vague acceptance criteria, and merge trivial tasks.
tags:
  - task-management
  - planning
  - quality
kk_schema_version: 3
kk_id: practice-review-every-generated-task-for-complexity-vagueness-and-triviality
kk_derived_from:
  - .ai/task-manager/config/hooks/POST_TASK_GENERATION_ALL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
After all tasks have been generated, perform a sanity check on each one:

- **Too complex?** If a task spans 3+ technologies or requires 3+ skills, split it.
- **Too vague?** If acceptance criteria are unclear, sharpen them.
- **Too trivial?** If two tasks could be one without adding complexity, merge them.

Target: every task should be completable with 1-2 skills and have clear acceptance criteria.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/hooks/POST_TASK_GENERATION_ALL.md](.ai/task-manager/config/hooks/POST_TASK_GENERATION_ALL.md)
<!-- kk:citations:end -->
