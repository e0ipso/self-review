---
type: practice
title: Lazy-load file hunks in large-payload mode
description: >-
  When max-files or max-total-lines is exceeded, send file metadata only in
  diff:load and fetch hunks per file on demand.
tags:
  - large-diff
  - performance
  - payload
kk_schema_version: 3
kk_id: practice-lazy-load-file-hunks-in-large-payload-mode
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The app has a configurable large-payload guard with dual thresholds (`max-files`, default 500; `max-total-lines`, default 100000). When either is exceeded, a confirmation dialog shows payload stats; the user can cancel or continue.

On continue, large-payload mode is enabled: the initial `diff:load` payload includes file metadata (paths, change types, stats) but omits hunks. Hunks are fetched on demand via the `diff:load-file` IPC channel as the user navigates. This prevents the renderer from being overwhelmed by very large diffs.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
