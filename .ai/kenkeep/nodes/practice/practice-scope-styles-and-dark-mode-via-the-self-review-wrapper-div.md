---
schema_version: 1
id: practice-scope-styles-and-dark-mode-via-the-self-review-wrapper-div
title: Scope styles and dark mode via the .self-review wrapper div
kind: practice
tags:
  - css
  - scoping
  - theming
derived_from:
  - packages/react/AGENTS.md
relates_to: []
confidence: high
summary: >-
  All overrides are prefixed .self-review; dark class toggles on the wrapper,
  not html.
---
`ConfigProvider` renders a `<div className="self-review">` (with `display: contents`) around its children. The `dark` class is toggled on this wrapper instead of `document.documentElement`, and dark utilities activate via `@custom-variant dark (&:is(.dark *))`.

All `*` selectors and component-specific overrides in `styles.css` are prefixed with `.self-review` to prevent style leakage into host applications.
