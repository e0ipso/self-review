---
schema_version: 1
id: practice-review-plans-against-prd-and-test-features-updates
title: Review plans against PRD and test/features updates
kind: practice
tags:
  - planning
  - prd
  - tests
derived_from:
  - .ai/task-manager/config/hooks/POST_PLAN.md
relates_to: []
confidence: high
summary: >-
  After producing a plan, confirm whether PRD.md and test/features need updates,
  keeping additions succinct and skipping them for minimal changes.
---
When the POST_PLAN hook runs, check whether the plan includes necessary updates to `PRD.md` and `test/features`. Keep any inclusions or updates succinct.

For minimal feature changes, consider not amending `PRD.md` or tests at all. Update the plan if either check is unmet.
