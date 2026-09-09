---
type: map
title: Large-payload lazy-loading mode
description: >-
  When a diff exceeds max-files or max-total-lines, files load without hunks
  initially and hunks are fetched lazily via diff:load-file.
tags:
  - strikethroo
  - large-payload
  - perf
kk_schema_version: 3
kk_id: map-large-payload-lazy-loading-mode
kk_derived_from:
  - AGENTS.md
kk_relates_to:
  - map-two-process-electron-architecture
  - practice-lazy-load-file-hunks-in-large-payload-mode
kk_depends_on: []
kk_confidence: high
---
When the diff exceeds configurable thresholds (`max-files` or `max-total-lines`), the main process sends file metadata without hunks in the initial `diff:load` payload. The renderer lazily requests each file's hunks via the `diff:load-file` IPC channel as the user navigates, avoiding memory pressure from loading the entire diff at once.

Payload sizing is computed in `src/main/payload-sizing.ts`.

<!-- kk:citations:start -->
# Citations

[1] [AGENTS.md](../../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-two-process-electron-architecture](map-two-process-electron-architecture.md)
- Related: [practice-lazy-load-file-hunks-in-large-payload-mode](practice-lazy-load-file-hunks-in-large-payload-mode.md)
<!-- kk:related:end -->
