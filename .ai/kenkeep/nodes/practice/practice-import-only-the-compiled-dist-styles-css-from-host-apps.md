---
schema_version: 1
id: practice-import-only-the-compiled-dist-styles-css-from-host-apps
title: Import only the compiled dist/styles.css from host apps
kind: practice
tags:
  - css
  - build
  - imports
derived_from:
  - packages/react/AGENTS.md
relates_to: []
confidence: high
summary: >-
  src/styles.css and src/build-styles.css are build inputs only; never import
  them.
---
Host apps must import `@self-review/react/styles.css` (the compiled, self-contained file produced by `npm run build:css`).

Do not import `src/styles.css` (contains Tailwind directives and CSS variable definitions, build input only) or `src/build-styles.css` (Tailwind CLI entrypoint, not shipped in the package) directly.
