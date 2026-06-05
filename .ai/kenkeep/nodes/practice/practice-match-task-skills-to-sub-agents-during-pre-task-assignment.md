---
schema_version: 1
id: practice-match-task-skills-to-sub-agents-during-pre-task-assignment
title: Match task skills to sub-agents during PRE_TASK_ASSIGNMENT
kind: practice
tags:
  - task-assignment
  - agents
  - hooks
derived_from:
  - .ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md
relates_to: []
confidence: high
summary: >-
  Read task frontmatter skills and select the most appropriate sub-agent; fall
  back to a general-purpose agent when none matches.
---
Before task assignment, extract the `skills` array from each task's frontmatter and analyze the technical domain from its description. Match those skills against the capabilities of available sub-agents and select the best fit.

If no sub-agent is appropriate or none are available, use the general-purpose agent rather than over-provisioning.

Selection criteria are: primary skill match (from the `skills` array), domain expertise (frameworks/libraries in the description), task complexity (senior vs. junior capabilities), and resource efficiency.
