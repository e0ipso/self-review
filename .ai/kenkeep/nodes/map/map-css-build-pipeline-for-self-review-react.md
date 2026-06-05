---
schema_version: 1
id: map-css-build-pipeline-for-self-review-react
title: CSS build pipeline for @self-review/react
kind: map
tags:
  - css
  - build
  - tailwind
derived_from:
  - packages/react/AGENTS.md
relates_to: []
confidence: high
summary: tsup + @tailwindcss/cli compile src/build-styles.css into dist/styles.css.
---
`npm run build` runs `tsup && npm run build:css`. The `build:css` script uses `@tailwindcss/cli` to compile `src/build-styles.css` into `dist/styles.css`, a self-contained file with all Tailwind utility classes used by the library.

Inputs: `src/styles.css` (Tailwind `@custom-variant`/`@theme inline` directives, CSS custom properties for `:root` and `.dark`, component overrides) and `src/build-styles.css` (Tailwind CLI entrypoint that imports `tailwindcss`, the typography plugin, `styles.css`, plus `@source "../dist"`).
