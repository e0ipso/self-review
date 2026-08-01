---
type: map
title: PRE_TASK_ASSIGNMENT hook
description: >-
  Hook that runs before task assignment to select an appropriate agent for each
  task based on required skills.
tags:
  - hooks
  - task-manager
  - ai
kk_schema_version: 3
kk_id: map-pre-task-assignment-hook
kk_derived_from:
  - .ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`PRE_TASK_ASSIGNMENT` is a task-manager hook documented at `.ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md`. It executes before task assignment and is responsible for matching each task to the most appropriate sub-agent (or general-purpose agent) based on the task's declared skills and technical domain.

It relies on the helper script `.ai/task-manager/config/scripts/extract-task-skills.cjs` to extract the `skills` array from a task file's frontmatter, and scans assistant agent directories (`.claude/agents`, `.gemini/agents`, `.opencode/agents`) to detect available sub-agents.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md](.ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md)
<!-- kk:citations:end -->
