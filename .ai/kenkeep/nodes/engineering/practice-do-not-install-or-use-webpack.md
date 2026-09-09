---
type: practice
title: Check the existing Forge bundler before changing build tooling
description: >-
  Forge is the build entry point; bundling changes belong in the three webpack
  configs its plugin points at.
tags:
  - strikethroo
  - build
  - webpack
kk_schema_version: 3
kk_id: practice-do-not-install-or-use-webpack
kk_derived_from:
  - AGENTS.md
  - forge.config.ts
  - webpack.main.config.ts
kk_relates_to:
  - map-self-review
kk_depends_on: []
kk_confidence: high
---
Electron Forge is the build entry point: `forge.config.ts` registers `WebpackPlugin` from
`@electron-forge/plugin-webpack`, and that plugin owns the bundling. Do not run webpack outside Forge
and do not swap in another bundler.

Webpack itself is not forbidden. A bundling change belongs in the three configs the plugin points at,
`webpack.main.config.ts`, `webpack.renderer.config.ts` and `webpack.preload.config.ts`, plus the shared
`webpack.plugins.ts`. An older reading of AGENTS.md as a blanket prohibition on webpack is out of date;
AGENTS.md now states the narrower rule directly.

<!-- kk:citations:start -->
# Citations

[1] [AGENTS.md](../../../../AGENTS.md)
[2] [forge.config.ts](../../../../forge.config.ts)
[3] [webpack.main.config.ts](../../../../webpack.main.config.ts)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-self-review](../app/map-self-review.md)
<!-- kk:related:end -->
