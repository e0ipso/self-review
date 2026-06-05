---
schema_version: 1
id: practice-do-not-store-renderer-state-outside-react-context
title: Do not store renderer state outside React context
kind: practice
tags:
  - task-manager
  - state
  - renderer
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  All review state (comments, suggestions, viewed flags) lives in React context;
  no localStorage or globals.
---
The renderer manages all review state in React context (`ReviewContext`, `ConfigContext`). Do not use `localStorage` or any browser storage APIs. Do not store any state outside of React context in the renderer.

**Why:** Single source of truth for review state, simpler to reason about, and avoids stale or duplicated state across components.
