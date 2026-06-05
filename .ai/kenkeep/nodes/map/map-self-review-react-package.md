---
schema_version: 1
id: map-self-review-react-package
title: '@self-review/react package'
kind: map
tags:
  - package
  - react
  - ui
derived_from:
  - packages/react/AGENTS.md
relates_to: []
confidence: high
summary: >-
  Embeddable React UI layer: diff viewer, file tree, commenting, syntax
  highlighting.
---
`@self-review/react` is the reusable UI layer consumed by the Electron renderer and the webapp e2e test harness. It provides `ReviewPanel` as the main entry point and exports individual components for custom composition.

Source lives under `packages/react/src/`, with subdirectories for `components/` (Layout, FileTree, Toolbar, DiffViewer, Comments), `context/`, `hooks/`, and `utils/`.
