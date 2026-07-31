---
type: practice
title: Use old vs new line numbers based on the commented line type
description: >-
  Added/context lines use newLineStart/End; deleted lines use oldLineStart/End;
  exactly one pair, never both.
tags:
  - task-manager
  - line-numbers
  - comments
kk_schema_version: 3
kk_id: practice-use-old-vs-new-line-numbers-based-on-the-commented-line-type
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Comments on added or context lines use `newLineStart`/`newLineEnd`. Comments on deleted lines use `oldLineStart`/`oldLineEnd`. Exactly one pair is set per comment, never both. File-level comments have neither.

**Why:** Old and new line numbering diverge across hunks; mixing them produces ambiguous or unresolvable references in downstream tooling.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
