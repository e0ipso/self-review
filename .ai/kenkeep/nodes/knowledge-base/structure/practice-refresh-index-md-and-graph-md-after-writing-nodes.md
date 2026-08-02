---
type: practice
title: Refresh INDEX.md and GRAPH.md after writing nodes
description: >-
  Run `npx @e0ipso/ai-knowledge-base index rebuild` after writing nodes so the
  indices reflect them before reviewer diff.
tags:
  - knowledge-base
  - cli
  - indexing
kk_schema_version: 3
kk_id: practice-refresh-index-md-and-graph-md-after-writing-nodes
kk_derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
After writing nodes, run `npx @e0ipso/ai-knowledge-base index rebuild --harness "$HARNESS"`.

**Why:** The reviewer inspects `git diff nodes/` plus the indices; stale indices hide newly-added nodes. **How to apply:** Always run the rebuild before reporting back to the user.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-bootstrap/SKILL.md](.cursor/skills/kb-bootstrap/SKILL.md)
<!-- kk:citations:end -->
