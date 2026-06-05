---
schema_version: 1
id: practice-review-every-generated-task-for-complexity-vagueness-and-triviality
title: 'Review every generated task for complexity, vagueness, and triviality'
kind: practice
tags:
  - task-management
  - planning
  - quality
derived_from:
  - .ai/task-manager/config/hooks/POST_TASK_GENERATION_ALL.md
relates_to: []
confidence: high
summary: >-
  After task generation, split tasks spanning 3+ technologies/skills, sharpen
  vague acceptance criteria, and merge trivial tasks.
---
After all tasks have been generated, perform a sanity check on each one:

- **Too complex?** If a task spans 3+ technologies or requires 3+ skills, split it.
- **Too vague?** If acceptance criteria are unclear, sharpen them.
- **Too trivial?** If two tasks could be one without adding complexity, merge them.

Target: every task should be completable with 1-2 skills and have clear acceptance criteria.
