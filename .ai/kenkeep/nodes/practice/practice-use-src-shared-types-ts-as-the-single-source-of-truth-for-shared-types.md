---
schema_version: 1
id: >-
  practice-use-src-shared-types-ts-as-the-single-source-of-truth-for-shared-types
title: Use src/shared/types.ts as the single source of truth for shared types
kind: practice
tags:
  - task-manager
  - types
  - duplication
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  All main and renderer code imports shared types from src/shared/types.ts;
  never duplicate definitions.
---
`src/shared/types.ts` is the single source of truth for all shared data structures (`DiffFile`, `DiffHunk`, `DiffLine`, `ReviewComment`, `Suggestion`, `ReviewState`, `AppConfig`, `CategoryDef`, `PayloadStats`). Every file in both main and renderer imports types from here. It re-exports from `packages/types/src/index`.

**Why:** Prevents drift between main and renderer over the IPC contract; the types file is THE CONTRACT.
