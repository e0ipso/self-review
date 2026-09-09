---
type: map
title: 'Kenkeep curation commands'
description: >-
  Extract, validate, deduplicate, persist and rebuild through deterministic
  commands.
tags:
  - kk-curate
  - cli
  - subcommands
kk_schema_version: 3
kk_id: map-e0ipso-ai-knowledge-base-cli-commands-used-by-kb-curate
kk_derived_from:
  - .agents/skills/kk-curate/SKILL.md
kk_relates_to:
  - map-knowledge-base-capture-curate-review-workflow
kk_depends_on: []
kk_confidence: high
---
The `kk-curate` skill reads sessions in-host. `session-log update-proposals` validates extraction output. `drafts collect` validates and combines batch drafts. One `curate-dedup` call separates conflicts and stamps consumed sessions, then `curate-persist` writes surviving actions. Run `index rebuild`, then `rebalance trigger`; apply structural operations only through `rebalance move`. `npx kenkeep curate` launches the skill and is not the in-host persistence command.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-curate/SKILL.md](../../../../../.agents/skills/kk-curate/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-knowledge-base-capture-curate-review-workflow](map-knowledge-base-capture-curate-review-workflow.md)
<!-- kk:related:end -->
