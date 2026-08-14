---
type: practice
title: Don't support Windows
description: >-
  Windows is explicitly out of scope. Supported platforms are macOS and Linux
  (x64 and arm64).
tags:
  - platform
  - scope
kk_schema_version: 3
kk_id: practice-don-t-support-windows
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Windows support is explicitly out of scope. The supported platforms are macOS (primary development) and Linux (x64 and arm64).

Do not add Windows-specific code paths, packaging targets, or workarounds.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
