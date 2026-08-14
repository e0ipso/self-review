---
type: map
title: self-review
description: >-
  Local-only Electron desktop app providing a GitHub-style PR review UI for
  local git diffs and directory reviews.
tags:
  - task-manager
  - app
  - overview
kk_schema_version: 3
kk_id: map-self-review
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`self-review` is a local-only Electron desktop app that provides a GitHub-style PR review UI for local git diffs and directory-based reviews (all files treated as new when no repo context is available). It is designed for solo developers reviewing AI-generated code with a CLI-first, one-shot workflow: open → review → close → XML to file.

When launched outside a git repo without a directory argument (e.g., from an app launcher), the app shows a welcome screen with a directory picker instead of exiting.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
