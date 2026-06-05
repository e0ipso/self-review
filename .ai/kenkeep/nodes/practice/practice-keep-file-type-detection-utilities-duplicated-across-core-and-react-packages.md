---
schema_version: 1
id: >-
  practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages
title: Keep file-type detection utilities duplicated across core and react packages
kind: practice
tags:
  - task-manager
  - file-type-utils
  - duplication
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  getRenderedTextMode, isPreviewableImage, isPreviewableSvg, getLanguageFromPath
  are intentionally duplicated.
---
Detection utilities (`getRenderedTextMode`, `isPreviewableImage`, `isPreviewableSvg`, `getLanguageFromPath`) are intentionally duplicated in both `@self-review/core` (`packages/core/src/file-type-utils.ts`) and `@self-review/react` (`packages/react/src/utils/file-type-utils.ts`). See the package AGENTS.md files for rationale.

**Why:** Package boundaries — neither package should depend on the other for these small pure utilities; AGENTS.md files in each package document the rationale.
