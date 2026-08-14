---
type: practice
title: Use src/shared/types.ts as the single source of truth for shared types
description: >-
  All main and renderer code imports shared types from src/shared/types.ts;
  never duplicate definitions.
tags:
  - task-manager
  - types
  - duplication
kk_schema_version: 3
kk_id: >-
  practice-use-src-shared-types-ts-as-the-single-source-of-truth-for-shared-types
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`src/shared/types.ts` is the single source of truth for all shared data structures (`DiffFile`, `DiffHunk`, `DiffLine`, `ReviewComment`, `Suggestion`, `ReviewState`, `AppConfig`, `CategoryDef`, `PayloadStats`). Every file in both main and renderer imports types from here. It re-exports from `packages/types/src/index`.

**Why:** Prevents drift between main and renderer over the IPC contract; the types file is THE CONTRACT.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
