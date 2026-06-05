---
schema_version: 1
id: practice-never-write-to-stdout-in-the-main-process
title: Never write to stdout in the main process
kind: practice
tags:
  - task-manager
  - logging
  - stdout
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  Use console.error() for logging in the main process; stdout is unused and
  reserved.
---
The Electron main process must never write to stdout. All logging goes to stderr via `console.error()`. The XML review output is written to a file (default `./review.xml`), not piped through stdout.

**Why:** The CLI workflow writes review output to a file, so stdout has no defined consumer. Mixing logs into stdout would corrupt the contract.
