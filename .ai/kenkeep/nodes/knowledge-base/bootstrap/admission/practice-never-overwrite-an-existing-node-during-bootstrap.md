---
type: practice
title: Never overwrite an existing node during bootstrap
description: >-
  Bootstrap is conservative: if a target node file already exists, refine the
  title or skip the candidate and report it.
tags:
  - knowledge-base
  - node-authoring
  - collision
kk_schema_version: 3
kk_id: practice-never-overwrite-an-existing-node-during-bootstrap
kk_derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Before writing each node at `.ai/knowledge-base/nodes/<kind>/<kind>-<slug>.md`, check whether the file already exists. If it does, either refine the title to avoid the collision or skip the candidate.

**Why:** Bootstrap should not destroy prior curated content. **How to apply:** Surface every skipped collision in the final report so the user can merge content manually if desired.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-bootstrap/SKILL.md](.cursor/skills/kb-bootstrap/SKILL.md)
<!-- kk:citations:end -->
