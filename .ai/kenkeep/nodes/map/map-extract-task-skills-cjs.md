---
schema_version: 1
id: map-extract-task-skills-cjs
title: extract-task-skills.cjs
kind: map
tags:
  - scripts
  - task-manager
  - skills
derived_from:
  - .ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md
relates_to: []
confidence: high
summary: Helper script that extracts the `skills` array from a task file's frontmatter.
---
Located at `.ai/task-manager/config/scripts/extract-task-skills.cjs`. Invoked by the PRE_TASK_ASSIGNMENT hook as `node "$root/config/scripts/extract-task-skills.cjs" "$TASK_FILE"` to read task skill requirements used for sub-agent matching.
