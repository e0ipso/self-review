---
schema_version: 1
id: >-
  practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan
title: Append a blueprint with dependency diagram and execution phases to the plan
kind: practice
tags:
  - task-management
  - blueprint
  - dependencies
derived_from:
  - .ai/task-manager/config/hooks/POST_TASK_GENERATION_ALL.md
relates_to: []
confidence: high
summary: >-
  After finalizing tasks, add a Mermaid dependency graph and group tasks into
  execution phases on the plan document.
---
After finalizing tasks, update the plan document with a blueprint:

- **Dependency Diagram**: If tasks have dependencies, add a Mermaid `graph TD` showing them. Verify there are no circular dependencies.
- **Execution Phases**: Group tasks into phases. Phase 1 contains tasks with no dependencies (run in parallel); Phase N contains tasks whose dependencies are all in earlier phases.

Use the template in `.ai/task-manager/config/templates/BLUEPRINT_TEMPLATE.md` for structure.

Before finalizing, verify: every task is in exactly one phase, no task runs before its dependencies complete, and Phase 1 has only zero-dependency tasks.
