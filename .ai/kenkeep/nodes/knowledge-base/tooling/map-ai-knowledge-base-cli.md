---
type: map
title: Kenkeep CLI
description: >-
  Deterministic commands discover documents, validate schemas and maintain nodes.
tags:
  - knowledge-base
  - cli
kk_schema_version: 3
kk_id: map-ai-knowledge-base-cli
kk_derived_from:
  - .agents/skills/kk-bootstrap/SKILL.md
  - .agents/skills/kk-curate/SKILL.md
kk_relates_to:
  - map-cli-static-skip-list
  - map-kb-detect-harness-helper-script
  - map-kb-harness-detection-script-at-tmp-kb-detect-harness-mjs
  - practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call
  - map-ai-knowledge-base-directory
kk_depends_on: []
kk_confidence: high
---
`npx kenkeep finddocs --with-hashes` lists candidate documents. `schema` and `validate` expose and check contracts. `curate-dedup` stamps consumed sessions and separates conflicts; `curate-persist` writes surviving actions. `index rebuild` regenerates navigation. These deterministic commands run directly in the current process; `curate` and `bootstrap` launch skills in a selected harness.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-bootstrap/SKILL.md](../../../../../.agents/skills/kk-bootstrap/SKILL.md)
[2] [.agents/skills/kk-curate/SKILL.md](../../../../../.agents/skills/kk-curate/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-cli-static-skip-list](map-cli-static-skip-list.md)
- Related: [map-kb-detect-harness-helper-script](map-kb-detect-harness-helper-script.md)
- Related: [map-kb-harness-detection-script-at-tmp-kb-detect-harness-mjs](map-kb-harness-detection-script-at-tmp-kb-detect-harness-mjs.md)
- Related: [practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call](practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md)
- Related: [map-ai-knowledge-base-directory](../structure/map-ai-knowledge-base-directory.md)
<!-- kk:related:end -->
