---
schema_version: 1
id: practice-make-no-network-connections-at-runtime
title: Make no network connections at runtime
kind: practice
tags:
  - network
  - privacy
  - local-only
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  The app is fully local: no network calls, no telemetry, no analytics, no CDN
  fetches.
---
The application does not open any network connections. All operations are local. No telemetry, no analytics, no auto-updates. All assets are bundled.

Rationale: the primary use case is reviewing AI-generated code that may be unfinished, experimental, or private — pushing it to a remote server (even GitHub) defeats the purpose of a local review tool.
