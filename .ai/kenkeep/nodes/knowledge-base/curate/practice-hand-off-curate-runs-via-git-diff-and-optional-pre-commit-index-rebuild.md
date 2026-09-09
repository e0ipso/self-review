---
type: practice
title: Report curation results after rebuilding navigation
description: >-
  Report counts, placements, structural actions and failures for review.
tags:
  - kk-curate
  - handoff
  - index
kk_schema_version: 3
kk_id: >-
  practice-hand-off-curate-runs-via-git-diff-and-optional-pre-commit-index-rebuild
kk_derived_from:
  - .agents/skills/kk-curate/SKILL.md
  - .lintstagedrc
kk_relates_to:
  - map-knowledge-base-capture-curate-review-workflow
kk_depends_on: []
kk_confidence: medium
---
After persistence, rebuild indices and run the rebalance trigger. Report counts, each written leaf placement, any failures or pending conflicts, and structural actions. Review changes under `.ai/kenkeep/`. The current repository lint-staged configuration does not rebuild kenkeep indices, so do not rely on committing to refresh them.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-curate/SKILL.md](../../../../../.agents/skills/kk-curate/SKILL.md)
[2] [.lintstagedrc](../../../../../.lintstagedrc)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-knowledge-base-capture-curate-review-workflow](map-knowledge-base-capture-curate-review-workflow.md)
<!-- kk:related:end -->
