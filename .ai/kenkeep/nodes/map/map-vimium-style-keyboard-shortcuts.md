---
schema_version: 1
id: map-vimium-style-keyboard-shortcuts
title: Vimium-style keyboard shortcuts
kind: map
tags:
  - task-manager
  - keyboard
  - vimium
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  Hint-driven navigation: f for diff lines, g for file tree, j/k for scroll,
  Ctrl+F for find, Escape to dismiss.
---
The app supports Vimium-style keyboard navigation:

- `Ctrl/Cmd+F` — open find-in-page search bar
- `f` — activate hint labels on changed diff lines to open a comment input
- `g` — activate hint labels on file tree entries to jump to a file
- `j` / `k` — smooth scroll the diff pane down/up
- `Escape` — dismiss active hint overlay or close find bar

All shortcuts are suppressed when a text input has focus. Implementation lives in the `useKeyboardNavigation` hook with `HintOverlay` for rendering hint badges.
