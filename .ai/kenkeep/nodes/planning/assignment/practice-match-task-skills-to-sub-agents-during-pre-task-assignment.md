---
type: practice
title: Match task skills to sub-agents during PRE_TASK_ASSIGNMENT
description: >-
  Read task frontmatter skills and select the most appropriate sub-agent; fall
  back to a general-purpose agent when none matches.
tags:
  - task-assignment
  - agents
  - hooks
kk_schema_version: 3
kk_id: practice-match-task-skills-to-sub-agents-during-pre-task-assignment
kk_derived_from:
  - .ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Before task assignment, extract the `skills` array from each task's frontmatter and analyze the technical domain from its description. Match those skills against the capabilities of available sub-agents and select the best fit.

If no sub-agent is appropriate or none are available, use the general-purpose agent rather than over-provisioning.

Selection criteria are: primary skill match (from the `skills` array), domain expertise (frameworks/libraries in the description), task complexity (senior vs. junior capabilities), and resource efficiency.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md](.ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md)
<!-- kk:citations:end -->
