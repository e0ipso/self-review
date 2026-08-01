---
type: practice
title: Import only the compiled dist/styles.css from host apps
description: >-
  src/styles.css and src/build-styles.css are build inputs only; never import
  them.
tags:
  - css
  - build
  - imports
kk_schema_version: 3
kk_id: practice-import-only-the-compiled-dist-styles-css-from-host-apps
kk_derived_from:
  - packages/react/AGENTS.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Host apps must import `@self-review/react/styles.css` (the compiled, self-contained file produced by `npm run build:css`).

Do not import `src/styles.css` (contains Tailwind directives and CSS variable definitions, build input only) or `src/build-styles.css` (Tailwind CLI entrypoint, not shipped in the package) directly.

<!-- kk:citations:start -->
# Citations

[1] [packages/react/AGENTS.md](packages/react/AGENTS.md)
<!-- kk:citations:end -->
