---
schema_version: 1
id: practice-don-t-support-windows
title: Don't support Windows
kind: practice
tags:
  - platform
  - scope
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  Windows is explicitly out of scope. Supported platforms are macOS and Linux
  (x64 and arm64).
---
Windows support is explicitly out of scope. The supported platforms are macOS (primary development) and Linux (x64 and arm64).

Do not add Windows-specific code paths, packaging targets, or workarounds.
