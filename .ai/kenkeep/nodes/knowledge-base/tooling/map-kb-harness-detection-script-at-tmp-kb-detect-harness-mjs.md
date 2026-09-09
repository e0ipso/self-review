---
type: map
title: Kenkeep harness detector
description: >-
  The shipped helper resolves explicit hints, environment or CLI defaults.
tags:
  - kb
  - harness
  - detection
kk_schema_version: 3
kk_id: map-kb-harness-detection-script-at-tmp-kb-detect-harness-mjs
kk_derived_from:
  - .ai/kenkeep/scripts/kk-detect-harness.mjs
kk_relates_to:
  - map-ai-knowledge-base-cli
kk_depends_on: []
kk_confidence: high
---
Run `node .ai/kenkeep/scripts/kk-detect-harness.mjs --hint <id>`. The helper considers a registered explicit hint first, then environment detection, then `cliDefaultHarness` in the nearest kenkeep project. Registered IDs are claude, codex, copilot, cursor and opencode. An unresolved invocation exits 2. The helper is shipped in the project; it is not materialized under /tmp.

<!-- kk:citations:start -->
# Citations

[1] [.ai/kenkeep/scripts/kk-detect-harness.mjs](../../../scripts/kk-detect-harness.mjs)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-ai-knowledge-base-cli](map-ai-knowledge-base-cli.md)
<!-- kk:related:end -->
