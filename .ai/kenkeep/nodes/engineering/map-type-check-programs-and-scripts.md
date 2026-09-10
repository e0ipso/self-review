---
type: map
title: Seven tsc programs behind five typecheck npm scripts
description: >-
  typecheck, typecheck:tests, typecheck:unit, typecheck:packages and
  typecheck:configs cover seven tsconfig programs; the CI lint job gates on all
  five.
tags:
  - typescript
  - tsconfig
  - typecheck
  - ci
  - build
kk_schema_version: 3
kk_id: map-type-check-programs-and-scripts
kk_derived_from: []
kk_relates_to:
  - >-
    practice-fix-webpack-type-checking-in-the-root-tsconfig-json-not-in-a-webpack-config
kk_depends_on: []
kk_confidence: high
---
Type-checking is seven separate `tsc` programs, reached through five npm scripts:

- `typecheck` runs `tsc -p tsconfig.json --noEmit`. The root program: `include: ["src/**/*"]`, test
  files excluded, `strict: true`.
- `typecheck:tests` runs `tsc -p tests/tsconfig.json`. The Playwright and Cucumber e2e sources.
- `typecheck:unit` runs `tsc -p tsconfig.unit-tests.json`. The `*.test.ts` and `*.test.tsx` files
  under both `src/` and `packages/`.
- `typecheck:packages` runs three programs in turn, `packages/types`, `packages/core` and
  `packages/react`, each as `tsc -p <pkg>/tsconfig.json --noEmit`.
- `typecheck:configs` runs `tsc -p tsconfig.build-configs.json`. The build and tooling configs that
  sit at the repository root.

The `Lint` job in `.github/workflows/ci.yml` runs all five after `lint` and `format:check`, so a
change that fails any one of them fails CI.

`tsconfig.build-configs.json` includes `"*.ts"`, a glob rather than a file list, so a config added at
the root later joins the program with nobody remembering to list it. The root-level set is nine
files today: `forge.config.ts`, `playwright.config.ts`, the two vitest configs and the five webpack
files. They were in no program at all before that config existed, because the root program reaches
only `src/**/*`, the unit and e2e programs reach only their test trees, and each package program
stays inside its own directory. Its `target` is ES2022, not the root config's ES6, because these
files run under Node through Forge, vitest and Playwright and never in a browser.

Nothing else type-checks. All three packages build with `tsup`, which transpiles through esbuild and
does not type-check even with `dts: true`: with a deliberate type error in
`packages/core/src/browser.ts`, `npm run build --workspace @self-review/core` still exits 0 while
`npm run typecheck:packages` exits 2.

<!-- kk:related:start -->
# Related

- Related: [practice-fix-webpack-type-checking-in-the-root-tsconfig-json-not-in-a-webpack-config](/engineering/practice-fix-webpack-type-checking-in-the-root-tsconfig-json-not-in-a-webpack-config.md)
<!-- kk:related:end -->
