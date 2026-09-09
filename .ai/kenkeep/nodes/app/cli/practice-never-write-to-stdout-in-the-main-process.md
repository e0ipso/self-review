---
type: practice
title: Never write to stdout in the main process
description: >-
  Use console.error() for logging in the main process; stdout is unused and
  reserved.
tags:
  - strikethroo
  - logging
  - stdout
kk_schema_version: 3
kk_id: practice-never-write-to-stdout-in-the-main-process
kk_derived_from:
  - AGENTS.md
kk_relates_to:
  - map-self-review-cli-invocations
kk_depends_on: []
kk_confidence: high
---
The Electron main process must never write to stdout. All logging goes to stderr via `console.error()`. The XML review output is written to a file (default `./review.xml`), not piped through stdout.

**Why:** The CLI workflow writes review output to a file, so stdout has no defined consumer. Mixing logs into stdout would corrupt the contract.

<!-- kk:citations:start -->
# Citations

[1] [AGENTS.md](../../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-self-review-cli-invocations](map-self-review-cli-invocations.md)
<!-- kk:related:end -->
