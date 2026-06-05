---
schema_version: 1
id: map-self-review-wrapper-div
title: .self-review wrapper div
kind: map
tags:
  - dom
  - scoping
  - theming
derived_from:
  - packages/react/AGENTS.md
relates_to: []
confidence: high
summary: >-
  Scoping wrapper rendered by ConfigProvider for CSS containment and dark-mode
  toggling.
---
`ConfigProvider` renders `<div className="self-review" style={{ display: 'contents' }}>` around its children. The wrapper serves two roles: theme scoping (the `dark` class toggles here instead of on `document.documentElement`) and CSS containment (all `*` selectors and overrides in `styles.css` are prefixed with `.self-review`).

It is also used as the `container` for Radix/shadcn portal-based components.
