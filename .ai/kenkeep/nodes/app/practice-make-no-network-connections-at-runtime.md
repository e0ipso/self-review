---
type: practice
title: Make no network connections at runtime
description: >-
  The app is fully local: no network calls, no telemetry, no analytics, no CDN
  fetches.
tags:
  - network
  - privacy
  - local-only
kk_schema_version: 3
kk_id: practice-make-no-network-connections-at-runtime
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The application does not open any network connections. All operations are local. No telemetry, no analytics, no auto-updates. All assets are bundled.

Rationale: the primary use case is reviewing AI-generated code that may be unfinished, experimental, or private — pushing it to a remote server (even GitHub) defeats the purpose of a local review tool.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
