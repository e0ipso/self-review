---
type: practice
title: Scope styles and dark mode via the .self-review wrapper div
description: >-
  All overrides are prefixed .self-review; dark class toggles on the wrapper,
  not html.
tags:
  - css
  - scoping
  - theming
kk_schema_version: 3
kk_id: practice-scope-styles-and-dark-mode-via-the-self-review-wrapper-div
kk_derived_from:
  - packages/react/AGENTS.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`ConfigProvider` renders a `<div className="self-review">` (with `display: contents`) around its children. The `dark` class is toggled on this wrapper instead of `document.documentElement`, and dark utilities activate via `@custom-variant dark (&:is(.dark *))`.

All `*` selectors and component-specific overrides in `styles.css` are prefixed with `.self-review` to prevent style leakage into host applications.

<!-- kk:citations:start -->
# Citations

[1] [packages/react/AGENTS.md](packages/react/AGENTS.md)
<!-- kk:citations:end -->
