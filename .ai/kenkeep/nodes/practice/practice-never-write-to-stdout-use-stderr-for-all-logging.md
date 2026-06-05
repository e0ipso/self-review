---
schema_version: 1
id: practice-never-write-to-stdout-use-stderr-for-all-logging
title: Never write to stdout; use stderr for all logging
kind: practice
tags:
  - logging
  - stdout
  - cli
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  stdout is unused. XML goes to a file; all progress, warnings, errors go to
  stderr.
---
The CLI writes XML output to a file (default `./review.xml`, configurable via `output-file` in YAML config). Nothing is written to stdout. All logging, progress messages, warnings, and errors go to stderr.

In the main process, use `console.error()` for logging; never use `console.log()`. The output file path is logged to stderr on successful write.
