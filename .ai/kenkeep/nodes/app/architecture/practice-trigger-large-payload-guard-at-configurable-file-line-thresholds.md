---
type: practice
title: Trigger large-payload guard at configurable file/line thresholds
description: >-
  When diff exceeds `max-files` (default 500) or `max-total-lines` (default
  100000), prompt the user; continuing enables lazy loading.
tags:
  - payload
  - performance
  - ux
kk_schema_version: 3
kk_id: practice-trigger-large-payload-guard-at-configurable-file-line-thresholds
kk_derived_from:
  - README.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
From README configuration: "When either threshold is exceeded, a confirmation dialog appears. Cancelling exits the app; continuing enters large-payload mode with lazy content loading (file hunks are fetched on demand as you scroll)." Both thresholds accept `0` to disable.

**Why:** Loading huge diffs eagerly causes memory pressure; the guard gives the user a choice before committing to a slow load.

**How to apply:** Preserve the cancel-vs-continue dialog semantics and the `0`-disables convention when touching payload sizing logic.

<!-- kk:citations:start -->
# Citations

[1] [README.md](README.md)
<!-- kk:citations:end -->
