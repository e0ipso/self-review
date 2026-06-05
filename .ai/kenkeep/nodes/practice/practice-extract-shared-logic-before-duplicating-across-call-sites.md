---
schema_version: 1
id: practice-extract-shared-logic-before-duplicating-across-call-sites
title: Extract shared logic before duplicating across call sites
kind: practice
tags:
  - task-manager
  - code-reuse
  - duplication
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  Refactor existing code into reusable utilities before building overlapping
  features; never copy-paste and modify.
---
Strongly favor extracting small, reusable functions and modules over writing similar code in multiple places. When adding a feature that overlaps with existing functionality, refactor the existing code into a reusable abstraction first, then build on top of it. Do not copy-paste and modify. Prefer many small single-purpose functions over large monolithic ones.

**Why:** Drift between near-duplicate implementations is a recurring source of bugs; small focused utilities are also independently testable.
