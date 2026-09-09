---
type: practice
title: 'Fix webpack type-checking in the root tsconfig.json, not in a webpack config'
description: >-
  fork-ts-checker defaults configFile to <context>/tsconfig.json and all three
  webpack configs set context to the project root.
tags:
  - build
  - webpack
  - typescript
  - tsconfig
kk_schema_version: 3
kk_id: >-
  practice-fix-webpack-type-checking-in-the-root-tsconfig-json-not-in-a-webpack-config
kk_derived_from: []
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`webpack.plugins.ts` constructs `ForkTsCheckerWebpackPlugin` with only a `logger` option, so
`configFile` keeps its default of `<context>/tsconfig.json`. All three configs set
`context: path.resolve(__dirname)`, which is the project root: `webpack.main.config.ts`,
`webpack.renderer.config.ts` and `webpack.preload.config.ts`. One root `tsconfig.json` therefore
governs type-checking for the dev server and the packaged build alike, and a fix there needs no
webpack config edit at all.

The `paths` entry mapping `@self-review/types` to `packages/types/src/index.ts` is safe to add for
the same reason it is only a type-level concern: the package has no runtime exports, so webpack's own
module resolution pointing at `dist` emits nothing and the two resolutions cannot disagree at
runtime.

**Why:** Changing a webpack config to reach a type-checking setting adds three edit sites for a
single-source problem, and Forge is the only sanctioned entry point to those configs.
