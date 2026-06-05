---
schema_version: 1
id: practice-engage-relevant-assistant-skills-based-on-task-skills
title: Engage relevant assistant skills based on task skills
kind: practice
tags:
  - task-assignment
  - skills
  - assistant-skills
derived_from:
  - .ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md
relates_to: []
confidence: high
summary: >-
  Analyze the set of task skills to engage any relevant assistant skills (global
  or project) during task assignment.
---
When processing tasks in the current phase, analyze the aggregated set of `skills` across tasks to determine whether any global or project-level assistant skills should be engaged for execution.

This is called out as `[IMPORTANT]` in the hook documentation, meaning skill engagement is a required step of the pre-assignment flow, not optional.
