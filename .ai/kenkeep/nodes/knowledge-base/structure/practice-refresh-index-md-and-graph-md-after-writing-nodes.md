---
type: practice
title: Regenerate kenkeep navigation after node changes
description: >-
  Use index rebuild for ENTRY.md, GRAPH.md and topical index nodes.
tags:
  - knowledge-base
  - cli
  - indexing
kk_schema_version: 3
kk_id: practice-refresh-index-md-and-graph-md-after-writing-nodes
kk_derived_from:
  - .agents/skills/kk-curate/SKILL.md
  - .lintstagedrc
kk_relates_to:
  - map-ai-knowledge-base-directory
kk_depends_on: []
kk_confidence: high
---
Edit knowledge leaves, then run `npx kenkeep index rebuild`. ENTRY.md, GRAPH.md and branch index.md files are generated navigation and must not be edited by hand. The repository `.lintstagedrc` formats Markdown but does not perform this rebuild.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-curate/SKILL.md](../../../../../.agents/skills/kk-curate/SKILL.md)
[2] [.lintstagedrc](../../../../../.lintstagedrc)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-ai-knowledge-base-directory](map-ai-knowledge-base-directory.md)
<!-- kk:related:end -->
