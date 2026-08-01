---
type: map
title: '@self-review/react package'
description: >-
  Embeddable React UI layer: diff viewer, file tree, commenting, syntax
  highlighting.
tags:
  - package
  - react
  - ui
kk_schema_version: 3
kk_id: map-self-review-react-package
kk_derived_from:
  - packages/react/AGENTS.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`@self-review/react` is the reusable UI layer consumed by the Electron renderer and the webapp e2e test harness. It provides `ReviewPanel` as the main entry point and exports individual components for custom composition.

Source lives under `packages/react/src/`, with subdirectories for `components/` (Layout, FileTree, Toolbar, DiffViewer, Comments), `context/`, `hooks/`, and `utils/`.

<!-- kk:citations:start -->
# Citations

[1] [packages/react/AGENTS.md](packages/react/AGENTS.md)
<!-- kk:citations:end -->
