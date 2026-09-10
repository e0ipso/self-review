---
type: map
title: Six tsc programs behind four typecheck npm scripts
description: >-
  typecheck, typecheck:tests, typecheck:unit and typecheck:packages cover six
  tsconfig programs; the CI lint job gates on all four.
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
Type-checking is six separate `tsc` programs, reached through four npm scripts:

- `typecheck` runs `tsc -p tsconfig.json --noEmit`. The root program: `include: ["src/**/*"]`, test
  files excluded, `strict: true`.
- `typecheck:tests` runs `tsc -p tests/tsconfig.json`. The Playwright and Cucumber e2e sources.
- `typecheck:unit` runs `tsc -p tsconfig.unit-tests.json`. The `*.test.ts` and `*.test.tsx` files
  under both `src/` and `packages/`.
- `typecheck:packages` runs three programs in turn, `packages/types`, `packages/core` and
  `packages/react`, each as `tsc -p <pkg>/tsconfig.json --noEmit`.

The `Lint` job in `.github/workflows/ci.yml` runs all four after `lint` and `format:check`, so a
change that fails any one of them fails CI.

Nothing else type-checks. All three packages build with `tsup`, which transpiles through esbuild and
does not type-check even with `dts: true`: with a deliberate type error in
`packages/core/src/browser.ts`, `npm run build --workspace @self-review/core` still exits 0 while
`npm run typecheck:packages` exits 2.

<!-- kk:related:start -->
# Related

- Related: [practice-fix-webpack-type-checking-in-the-root-tsconfig-json-not-in-a-webpack-config](/engineering/practice-fix-webpack-type-checking-in-the-root-tsconfig-json-not-in-a-webpack-config.md)
<!-- kk:related:end -->
