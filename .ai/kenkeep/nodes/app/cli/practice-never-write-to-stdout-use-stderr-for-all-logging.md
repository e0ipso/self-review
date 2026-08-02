---
type: practice
title: Never write to stdout; use stderr for all logging
description: >-
  stdout is unused. XML goes to a file; all progress, warnings, errors go to
  stderr.
tags:
  - logging
  - stdout
  - cli
kk_schema_version: 3
kk_id: practice-never-write-to-stdout-use-stderr-for-all-logging
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The CLI writes XML output to a file (default `./review.xml`, configurable via `output-file` in YAML config). Nothing is written to stdout. All logging, progress messages, warnings, and errors go to stderr.

In the main process, use `console.error()` for logging; never use `console.log()`. The output file path is logged to stderr on successful write.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
