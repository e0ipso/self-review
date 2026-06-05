---
schema_version: 1
id: practice-mark-completed-phases-and-tasks-in-the-blueprint-before-advancing
title: Mark completed phases and tasks in the blueprint before advancing
kind: practice
tags:
  - workflow
  - progress-tracking
  - blueprint
derived_from:
  - .ai/task-manager/config/hooks/POST_PHASE.md
relates_to: []
confidence: high
summary: >-
  After validating a phase, update the blueprint: ✅ in front of the phase title,
  ✔️ in front of each task, and set task status to completed.
---
Once a phase has been completed and validated, and before moving to the next phase, update the plan/blueprint document. Add a ✅ emoji in front of the phase title, add a ✔️ emoji in front of every task in that phase, and update each task's status to `completed`.

This keeps the plan document as the source of truth for phase/task progress between executions.
