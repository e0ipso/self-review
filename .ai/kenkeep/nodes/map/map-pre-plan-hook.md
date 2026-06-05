---
schema_version: 1
id: map-pre-plan-hook
title: PRE_PLAN hook
kind: map
tags:
  - task-manager
  - hook
  - workflow
derived_from:
  - .ai/task-manager/config/hooks/PRE_PLAN.md
relates_to: []
confidence: medium
summary: >-
  Pre-planning hook that establishes scope control, simplicity principles, and
  PRD-only output before plan creation.
---
The PRE_PLAN hook lives at `.ai/task-manager/config/hooks/PRE_PLAN.md`. It is fired before comprehensive plan creation to inject guidance on scope control (YAGNI, minimal viable implementation, no unrequested BC), simplicity principles (simple over clever, standard patterns, minimal dependencies), and workflow boundaries (PRD only, no tasks/phases yet).

It references the plan template at `.ai/task-manager/config/templates/PLAN_TEMPLATE.md` as the structural source of truth for plan output.
