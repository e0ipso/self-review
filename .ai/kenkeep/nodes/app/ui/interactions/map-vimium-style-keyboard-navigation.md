---
type: map
title: Vimium-style keyboard navigation
description: >-
  f activates line-comment hints, g activates file-jump hints, j/k smooth
  scroll, Ctrl/Cmd+F opens find-in-page, Escape dismisses.
tags:
  - keyboard
  - navigation
  - vimium
kk_schema_version: 3
kk_id: map-vimium-style-keyboard-navigation
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The app supports keyboard-driven review via Vimium-style hint labels and smooth scrolling:

- `f` — activate hint labels on changed diff lines to open a comment input
- `g` — activate hint labels on file tree entries to jump to a file
- `j` / `k` — smooth scroll the diff pane down/up
- `Ctrl/Cmd+F` — open Chromium's native find-in-page bar
- `Escape` — dismiss active hint overlay or close find bar

All shortcuts are suppressed when a text input has focus. Implementation lives in the `useKeyboardNavigation` hook with `HintOverlay` rendering hint badges.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
