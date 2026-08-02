---
type: map
title: extract-task-skills.cjs
description: Helper script that extracts the `skills` array from a task file's frontmatter.
tags:
  - scripts
  - task-manager
  - skills
kk_schema_version: 3
kk_id: map-extract-task-skills-cjs
kk_derived_from:
  - .ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Located at `.ai/task-manager/config/scripts/extract-task-skills.cjs`. Invoked by the PRE_TASK_ASSIGNMENT hook as `node "$root/config/scripts/extract-task-skills.cjs" "$TASK_FILE"` to read task skill requirements used for sub-agent matching.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md](.ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md)
<!-- kk:citations:end -->
