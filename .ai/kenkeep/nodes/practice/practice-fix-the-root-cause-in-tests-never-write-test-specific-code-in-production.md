---
schema_version: 1
id: >-
  practice-fix-the-root-cause-in-tests-never-write-test-specific-code-in-production
title: 'Fix the root cause in tests, never write test-specific code in production'
kind: practice
tags:
  - task-manager
  - testing
  - root-cause
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  No environment detection, no conditional test bypasses; green tests must mean
  the code actually works.
---
Never write test-specific code in production source files. Never use environment detection to make tests pass. Never create conditional logic that masks real issues in tests. Green tests must mean the underlying code actually works correctly. Fix the root cause, not the test symptoms.

**Why:** Tests that pass only via production-side hacks provide false confidence and hide real defects.
