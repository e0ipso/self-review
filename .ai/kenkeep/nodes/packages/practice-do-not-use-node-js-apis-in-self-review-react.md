---
type: practice
title: Do not use Node.js APIs in @self-review/react
description: 'The react package is browser-only; no fs, child_process, or path imports.'
tags:
  - react
  - browser
  - constraints
kk_schema_version: 3
kk_id: practice-do-not-use-node-js-apis-in-self-review-react
kk_derived_from:
  - packages/react/AGENTS.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`@self-review/react` runs in renderer processes and browser environments. Do not import Node.js APIs such as `fs`, `child_process`, or `path` from this package.

This constraint exists because the package is consumed both by the Electron renderer and by the webapp e2e test harness, neither of which has Node runtime access in the contexts where these components render.

<!-- kk:citations:start -->
# Citations

[1] [packages/react/AGENTS.md](packages/react/AGENTS.md)
<!-- kk:citations:end -->
