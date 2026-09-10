---
type: practice
title: >-
  Check each package with its own tsconfig; the root program only follows
  imports
description: >-
  The root program includes only src/**/*, so package files the app never
  imports are covered by typecheck:packages alone.
tags:
  - typescript
  - tsconfig
  - typecheck
  - packages
  - ci
kk_schema_version: 3
kk_id: practice-check-each-package-with-its-own-tsconfig
kk_derived_from: []
kk_relates_to:
  - map-type-check-programs-and-scripts
  - map-npm-workspaces-packages
kk_depends_on: []
kk_confidence: high
---
The root `tsconfig.json` sets `include: ["src/**/*"]`. It still reaches most package source, but only
transitively, through what `src/` imports: 114 of the 128 non-test files under `packages/*/src` land
in the root program and 14 do not. `packages/core/src/browser.ts` is one of the 14. Put a type error
there and `npm run typecheck` stays at exit 0 while `npm run typecheck:packages` exits 2.

So the narrow root include is only safe while every package carries its own program in
`typecheck:packages`. A fourth package means a fourth `tsc -p` in that script. Each package
`include` also reaches its own tooling configs, `tsup.config.ts` plus `vitest.config.ts` and
`vitest.setup.ts` where they exist, so those files are type-checked too.

**Why:** Whether a file is type-checked should not depend on whether the Electron app happens to
import it. The per-package program makes coverage a property of the package.

<!-- kk:related:start -->
# Related

- Related: [map-type-check-programs-and-scripts](/engineering/map-type-check-programs-and-scripts.md)
- Related: [map-npm-workspaces-packages](/packages/architecture/map-npm-workspaces-packages.md)
<!-- kk:related:end -->
