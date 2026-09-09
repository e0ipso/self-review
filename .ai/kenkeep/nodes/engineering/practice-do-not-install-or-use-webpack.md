---
type: practice
title: Check the existing Forge bundler before changing build tooling
description: The blanket webpack prohibition conflicts with the configured Forge
  webpack integration.
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
AGENTS.md says not to install or use webpack because Electron Forge handles bundling. The existing Forge configuration nevertheless uses its webpack plugin and webpack.main.config.ts. Preserve that configured integration while this source inconsistency is unresolved; do not interpret the blanket sentence as an instruction to remove working build configuration.

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
