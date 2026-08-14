---
type: practice
title: Engage relevant assistant skills based on task skills
description: >-
  Analyze the set of task skills to engage any relevant assistant skills (global
  or project) during task assignment.
tags:
  - task-assignment
  - skills
  - assistant-skills
kk_schema_version: 3
kk_id: practice-engage-relevant-assistant-skills-based-on-task-skills
kk_derived_from:
  - .ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
When processing tasks in the current phase, analyze the aggregated set of `skills` across tasks to determine whether any global or project-level assistant skills should be engaged for execution.

This is called out as `[IMPORTANT]` in the hook documentation, meaning skill engagement is a required step of the pre-assignment flow, not optional.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md](.ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md)
<!-- kk:citations:end -->
