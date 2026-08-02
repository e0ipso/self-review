---
type: practice
title: Make zero network requests except the startup version check
description: >-
  No telemetry, analytics, or CDN fetches; only a fire-and-forget GitHub
  Releases check at startup.
tags:
  - task-manager
  - network
  - privacy
kk_schema_version: 3
kk_id: practice-make-zero-network-requests-except-the-startup-version-check
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The app makes zero network requests at runtime, with one exception: on startup it makes a single non-blocking request to `api.github.com` to check for updates. This request is fire-and-forget; any failure (offline, timeout, firewall) is silently ignored. No telemetry, no analytics, no CDN fetches. All assets are bundled.

**Why:** Local-only desktop app for solo developers; privacy and offline operation are core design goals.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
