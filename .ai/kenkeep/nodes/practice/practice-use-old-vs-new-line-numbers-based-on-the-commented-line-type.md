---
schema_version: 1
id: practice-use-old-vs-new-line-numbers-based-on-the-commented-line-type
title: Use old vs new line numbers based on the commented line type
kind: practice
tags:
  - task-manager
  - line-numbers
  - comments
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  Added/context lines use newLineStart/End; deleted lines use oldLineStart/End;
  exactly one pair, never both.
---
Comments on added or context lines use `newLineStart`/`newLineEnd`. Comments on deleted lines use `oldLineStart`/`oldLineEnd`. Exactly one pair is set per comment, never both. File-level comments have neither.

**Why:** Old and new line numbering diverge across hunks; mixing them produces ambiguous or unresolvable references in downstream tooling.
