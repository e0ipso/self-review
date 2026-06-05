---
schema_version: 1
id: practice-sessions-is-gitignored-provenance-does-not-travel-with-the-repo
title: _sessions/ is gitignored; provenance does not travel with the repo
kind: practice
tags:
  - knowledge-base
  - sessions
  - provenance
derived_from:
  - .ai/knowledge-base/README.md
relates_to: []
confidence: high
summary: >-
  derived_from session filenames only resolve for the original contributor
  unless your team explicitly commits _sessions/.
---
Raw captured transcripts under `_sessions/` and stream-json traces under `_logs/` are gitignored by default. A node's `derived_from` field may list session filenames that exist only on the original contributor's machine.

When reading a node, don't assume `derived_from` provenance can be inspected by anyone else on the team. Git history is the authoritative timeline for when a node was written or rewritten.
