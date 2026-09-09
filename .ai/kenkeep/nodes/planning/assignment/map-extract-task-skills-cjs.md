---
type: map
title: Task skill extraction in PRE_TASK_ASSIGNMENT
description: Read the task YAML skills array directly; no helper script is required.
tags:
  - scripts
  - strikethroo
  - skills
kk_schema_version: 3
kk_id: map-extract-task-skills-cjs
kk_derived_from:
  - .ai/strikethroo/config/hooks/PRE_TASK_ASSIGNMENT.md
kk_relates_to:
  - map-pre-task-assignment-hook
kk_depends_on: []
kk_confidence: high
---
The PRE_TASK_ASSIGNMENT hook reads `skills` directly from task YAML frontmatter and checks the current harness agents directory. It does not invoke an extract-task-skills.cjs helper.

<!-- kk:citations:start -->
# Citations

[1] [.ai/strikethroo/config/hooks/PRE_TASK_ASSIGNMENT.md](../../../../strikethroo/config/hooks/PRE_TASK_ASSIGNMENT.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-pre-task-assignment-hook](map-pre-task-assignment-hook.md)
<!-- kk:related:end -->
