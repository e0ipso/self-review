---
type: practice
title: 'Fix the root cause in tests, never write test-specific code in production'
description: >-
  No environment detection, no conditional test bypasses; green tests must mean
  the code actually works.
tags:
  - task-manager
  - testing
  - root-cause
kk_schema_version: 3
kk_id: >-
  practice-fix-the-root-cause-in-tests-never-write-test-specific-code-in-production
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Never write test-specific code in production source files. Never use environment detection to make tests pass. Never create conditional logic that masks real issues in tests. Green tests must mean the underlying code actually works correctly. Fix the root cause, not the test symptoms.

**Why:** Tests that pass only via production-side hacks provide false confidence and hide real defects.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
