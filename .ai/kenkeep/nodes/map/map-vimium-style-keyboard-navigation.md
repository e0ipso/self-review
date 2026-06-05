---
schema_version: 1
id: map-vimium-style-keyboard-navigation
title: Vimium-style keyboard navigation
kind: map
tags:
  - keyboard
  - navigation
  - vimium
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  f activates line-comment hints, g activates file-jump hints, j/k smooth
  scroll, Ctrl/Cmd+F opens find-in-page, Escape dismisses.
---
The app supports keyboard-driven review via Vimium-style hint labels and smooth scrolling:

- `f` — activate hint labels on changed diff lines to open a comment input
- `g` — activate hint labels on file tree entries to jump to a file
- `j` / `k` — smooth scroll the diff pane down/up
- `Ctrl/Cmd+F` — open Chromium's native find-in-page bar
- `Escape` — dismiss active hint overlay or close find bar

All shortcuts are suppressed when a text input has focus. Implementation lives in the `useKeyboardNavigation` hook with `HintOverlay` rendering hint badges.
