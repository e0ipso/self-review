---
type: practice
title: Append a blueprint with dependency diagram and execution phases to the plan
description: >-
  After finalizing tasks, add a Mermaid dependency graph and group tasks into
  execution phases on the plan document.
tags:
  - task-management
  - blueprint
  - dependencies
kk_schema_version: 3
kk_id: >-
  practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan
kk_derived_from:
  - .ai/task-manager/config/hooks/POST_TASK_GENERATION_ALL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
After finalizing tasks, update the plan document with a blueprint:

- **Dependency Diagram**: If tasks have dependencies, add a Mermaid `graph TD` showing them. Verify there are no circular dependencies.
- **Execution Phases**: Group tasks into phases. Phase 1 contains tasks with no dependencies (run in parallel); Phase N contains tasks whose dependencies are all in earlier phases.

Use the template in `.ai/task-manager/config/templates/BLUEPRINT_TEMPLATE.md` for structure.

Before finalizing, verify: every task is in exactly one phase, no task runs before its dependencies complete, and Phase 1 has only zero-dependency tasks.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/hooks/POST_TASK_GENERATION_ALL.md](.ai/task-manager/config/hooks/POST_TASK_GENERATION_ALL.md)
<!-- kk:citations:end -->
