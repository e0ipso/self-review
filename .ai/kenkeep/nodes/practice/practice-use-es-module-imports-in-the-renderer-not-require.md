---
schema_version: 1
id: practice-use-es-module-imports-in-the-renderer-not-require
title: 'Use ES module imports in the renderer, not require()'
kind: practice
tags:
  - task-manager
  - modules
  - imports
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  Renderer code must use ES module import syntax; CommonJS require() is
  disallowed.
---
Do not use `require()` in the renderer. Use ES module imports exclusively. This pairs with the contextBridge isolation: the renderer should not have access to Node's CommonJS loader.

**Why:** Maintains the sandboxed renderer security model and matches the project's TypeScript/ESM conventions.
