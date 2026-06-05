---
schema_version: 1
id: practice-trigger-large-payload-guard-at-configurable-file-line-thresholds
title: Trigger large-payload guard at configurable file/line thresholds
kind: practice
tags:
  - payload
  - performance
  - ux
derived_from:
  - README.md
relates_to: []
confidence: high
summary: >-
  When diff exceeds `max-files` (default 500) or `max-total-lines` (default
  100000), prompt the user; continuing enables lazy loading.
---
From README configuration: "When either threshold is exceeded, a confirmation dialog appears. Cancelling exits the app; continuing enters large-payload mode with lazy content loading (file hunks are fetched on demand as you scroll)." Both thresholds accept `0` to disable.

**Why:** Loading huge diffs eagerly causes memory pressure; the guard gives the user a choice before committing to a slow load.

**How to apply:** Preserve the cancel-vs-continue dialog semantics and the `0`-disables convention when touching payload sizing logic.
