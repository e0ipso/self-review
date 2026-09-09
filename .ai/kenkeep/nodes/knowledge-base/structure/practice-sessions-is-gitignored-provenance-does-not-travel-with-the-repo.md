---
type: practice
title: _sessions/ is gitignored; provenance does not travel with the repo
description: >-
  derived_from session filenames only resolve for the original contributor
  unless your team explicitly commits _sessions/.
tags:
  - knowledge-base
  - sessions
  - provenance
kk_schema_version: 3
kk_id: practice-sessions-is-gitignored-provenance-does-not-travel-with-the-repo
kk_derived_from:
  - .ai/kenkeep/README.md
kk_relates_to:
  - map-ai-knowledge-base-directory
kk_depends_on: []
kk_confidence: high
---
Raw captured transcripts under `_sessions/` and stream-json traces under `_logs/` are gitignored by default. A node's `derived_from` field may list session filenames that exist only on the original contributor's machine.

When reading a node, don't assume `derived_from` provenance can be inspected by anyone else on the team. Git history is the authoritative timeline for when a node was written or rewritten.

<!-- kk:citations:start -->
# Citations

[1] [.ai/kenkeep/README.md](../../../README.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-ai-knowledge-base-directory](map-ai-knowledge-base-directory.md)
<!-- kk:related:end -->
