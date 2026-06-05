---
schema_version: 1
id: practice-make-zero-network-requests-except-the-startup-version-check
title: Make zero network requests except the startup version check
kind: practice
tags:
  - task-manager
  - network
  - privacy
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  No telemetry, analytics, or CDN fetches; only a fire-and-forget GitHub
  Releases check at startup.
---
The app makes zero network requests at runtime, with one exception: on startup it makes a single non-blocking request to `api.github.com` to check for updates. This request is fire-and-forget; any failure (offline, timeout, firewall) is silently ignored. No telemetry, no analytics, no CDN fetches. All assets are bundled.

**Why:** Local-only desktop app for solo developers; privacy and offline operation are core design goals.
