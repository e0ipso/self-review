---
type: practice
title: >-
  Select the harness for harness-specific kenkeep commands
description: >-
  Use explicit harness selection for launcher commands; deterministic commands
  need no override.
tags:
  - knowledge-base
  - harness
  - cli
kk_schema_version: 3
kk_id: >-
  practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call
kk_derived_from:
  - .ai/kenkeep/scripts/kk-detect-harness.mjs
  - .agents/skills/kk-curate/SKILL.md
  - .agents/skills/kk-bootstrap/SKILL.md
kk_relates_to:
  - map-ai-knowledge-base-cli
kk_depends_on: []
kk_confidence: high
---
For a harness-specific launcher, pass `--harness <id>` when environment detection is insufficient. The shipped detector is `.ai/kenkeep/scripts/kk-detect-harness.mjs`. In-host curation and bootstrap instructions call deterministic primitives directly without requiring a harness argument on every call.

<!-- kk:citations:start -->
# Citations

[1] [.ai/kenkeep/scripts/kk-detect-harness.mjs](../../../scripts/kk-detect-harness.mjs)
[2] [.agents/skills/kk-curate/SKILL.md](../../../../../.agents/skills/kk-curate/SKILL.md)
[3] [.agents/skills/kk-bootstrap/SKILL.md](../../../../../.agents/skills/kk-bootstrap/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-ai-knowledge-base-cli](map-ai-knowledge-base-cli.md)
<!-- kk:related:end -->
