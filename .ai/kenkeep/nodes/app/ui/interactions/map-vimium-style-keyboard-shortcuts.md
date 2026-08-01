---
type: map
title: Vimium-style keyboard shortcuts
description: >-
  Hint-driven navigation: f for diff lines, g for file tree, j/k for scroll,
  Ctrl+F for find, Escape to dismiss.
tags:
  - task-manager
  - keyboard
  - vimium
kk_schema_version: 3
kk_id: map-vimium-style-keyboard-shortcuts
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The app supports Vimium-style keyboard navigation:

- `Ctrl/Cmd+F` — open find-in-page search bar
- `f` — activate hint labels on changed diff lines to open a comment input
- `g` — activate hint labels on file tree entries to jump to a file
- `j` / `k` — smooth scroll the diff pane down/up
- `Escape` — dismiss active hint overlay or close find bar

All shortcuts are suppressed when a text input has focus. Implementation lives in the `useKeyboardNavigation` hook with `HintOverlay` for rendering hint badges.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
