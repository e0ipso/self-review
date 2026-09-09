---
type: practice
title: Run curation in the current session
description: >-
  Use kk-curate and its deterministic primitives without spawning a nested CLI.
tags:
  - kk-curate
  - cli
  - harness
kk_schema_version: 3
kk_id: practice-run-kb-curator-via-npx-with-explicit-harness-id
kk_derived_from:
  - .agents/skills/kk-curate/SKILL.md
kk_relates_to:
  - map-knowledge-base-capture-curate-review-workflow
kk_depends_on: []
kk_confidence: high
---
Invoke `/kk-curate` in the active session. Resolve the project with `node .ai/kenkeep/scripts/kk-detect-root.mjs`, read the extraction and admission prompts, process pending logs and use the documented CLI primitives. From a plain terminal, `npx kenkeep curate --harness <id>` launches the skill; do not call it recursively during an in-host curation.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-curate/SKILL.md](../../../../../.agents/skills/kk-curate/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-knowledge-base-capture-curate-review-workflow](map-knowledge-base-capture-curate-review-workflow.md)
<!-- kk:related:end -->
