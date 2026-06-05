---
schema_version: 1
id: practice-pass-portalcontainer-to-all-radix-shadcn-portal-components
title: Pass portalContainer to all Radix/shadcn portal components
kind: practice
tags:
  - radix
  - portals
  - theming
derived_from:
  - packages/react/AGENTS.md
relates_to: []
confidence: high
summary: >-
  Portals must render inside the .self-review subtree to inherit dark-mode
  variables.
---
All shadcn/ui portal-based components (`alert-dialog`, `dropdown-menu`, `select`, `tooltip`) must receive the `.self-review` wrapper div as their `container` prop via `useConfig().portalContainer`. Otherwise portals escape the scoped subtree and lose dark-mode CSS variables.

`portalContainer` is set synchronously via a callback ref during React's commit phase, before effects and before paint, so there is no null-on-first-render window.
