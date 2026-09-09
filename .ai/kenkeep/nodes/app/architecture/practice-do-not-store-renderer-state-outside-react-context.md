---
type: practice
title: Do not store renderer state outside React context
description: >-
  All review state (comments, suggestions, viewed flags) lives in React context;
  no localStorage or globals.
tags:
  - strikethroo
  - state
  - renderer
kk_schema_version: 3
kk_id: practice-do-not-store-renderer-state-outside-react-context
kk_derived_from:
  - AGENTS.md
kk_relates_to:
  - map-two-process-electron-architecture
kk_depends_on: []
kk_confidence: high
---
The renderer manages all review state in React context (`ReviewContext`, `ConfigContext`). Do not use `localStorage` or any browser storage APIs. Do not store any state outside of React context in the renderer.

**Why:** Single source of truth for review state, simpler to reason about, and avoids stale or duplicated state across components.

<!-- kk:citations:start -->
# Citations

[1] [AGENTS.md](../../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-two-process-electron-architecture](map-two-process-electron-architecture.md)
<!-- kk:related:end -->
