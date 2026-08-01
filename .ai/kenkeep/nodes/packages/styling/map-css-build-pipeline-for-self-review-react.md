---
type: map
title: CSS build pipeline for @self-review/react
description: tsup + @tailwindcss/cli compile src/build-styles.css into dist/styles.css.
tags:
  - css
  - build
  - tailwind
kk_schema_version: 3
kk_id: map-css-build-pipeline-for-self-review-react
kk_derived_from:
  - packages/react/AGENTS.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`npm run build` runs `tsup && npm run build:css`. The `build:css` script uses `@tailwindcss/cli` to compile `src/build-styles.css` into `dist/styles.css`, a self-contained file with all Tailwind utility classes used by the library.

Inputs: `src/styles.css` (Tailwind `@custom-variant`/`@theme inline` directives, CSS custom properties for `:root` and `.dark`, component overrides) and `src/build-styles.css` (Tailwind CLI entrypoint that imports `tailwindcss`, the typography plugin, `styles.css`, plus `@source "../dist"`).

<!-- kk:citations:start -->
# Citations

[1] [packages/react/AGENTS.md](packages/react/AGENTS.md)
<!-- kk:citations:end -->
