---
type: practice
title: 'Use ES module imports in the renderer, not require()'
description: >-
  Renderer code must use ES module import syntax; CommonJS require() is
  disallowed.
tags:
  - task-manager
  - modules
  - imports
kk_schema_version: 3
kk_id: practice-use-es-module-imports-in-the-renderer-not-require
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Do not use `require()` in the renderer. Use ES module imports exclusively. This pairs with the contextBridge isolation: the renderer should not have access to Node's CommonJS loader.

**Why:** Maintains the sandboxed renderer security model and matches the project's TypeScript/ESM conventions.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
