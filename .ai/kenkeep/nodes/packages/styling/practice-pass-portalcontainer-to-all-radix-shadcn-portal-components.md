---
type: practice
title: Pass portalContainer to all Radix/shadcn portal components
description: >-
  Portals must render inside the .self-review subtree to inherit dark-mode
  variables.
tags:
  - radix
  - portals
  - theming
kk_schema_version: 3
kk_id: practice-pass-portalcontainer-to-all-radix-shadcn-portal-components
kk_derived_from:
  - packages/react/AGENTS.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
All shadcn/ui portal-based components (`alert-dialog`, `dropdown-menu`, `select`, `tooltip`) must receive the `.self-review` wrapper div as their `container` prop via `useConfig().portalContainer`. Otherwise portals escape the scoped subtree and lose dark-mode CSS variables.

`portalContainer` is set synchronously via a callback ref during React's commit phase, before effects and before paint, so there is no null-on-first-render window.

<!-- kk:citations:start -->
# Citations

[1] [packages/react/AGENTS.md](packages/react/AGENTS.md)
<!-- kk:citations:end -->
