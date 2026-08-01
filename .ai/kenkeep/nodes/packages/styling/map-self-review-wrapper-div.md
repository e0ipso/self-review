---
type: map
title: .self-review wrapper div
description: >-
  Scoping wrapper rendered by ConfigProvider for CSS containment and dark-mode
  toggling.
tags:
  - dom
  - scoping
  - theming
kk_schema_version: 3
kk_id: map-self-review-wrapper-div
kk_derived_from:
  - packages/react/AGENTS.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`ConfigProvider` renders `<div className="self-review" style={{ display: 'contents' }}>` around its children. The wrapper serves two roles: theme scoping (the `dark` class toggles here instead of on `document.documentElement`) and CSS containment (all `*` selectors and overrides in `styles.css` are prefixed with `.self-review`).

It is also used as the `container` for Radix/shadcn portal-based components.

<!-- kk:citations:start -->
# Citations

[1] [packages/react/AGENTS.md](packages/react/AGENTS.md)
<!-- kk:citations:end -->
