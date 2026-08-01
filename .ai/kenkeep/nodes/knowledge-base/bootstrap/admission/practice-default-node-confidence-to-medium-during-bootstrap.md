---
type: practice
title: Default node confidence to medium during bootstrap
description: >-
  Use `confidence: medium` for bootstrap content by default; reserve `high` for
  explicitly-stated, actively-maintained docs.
tags:
  - knowledge-base
  - confidence
kk_schema_version: 3
kk_id: practice-default-node-confidence-to-medium-during-bootstrap
kk_derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Existing docs may be stale or aspirational, so the reviewer needs to assess each one. Use `confidence: high` only when the doc explicitly states the rule with rationale and the doc looks actively maintained.

**Why:** Overstated confidence misleads downstream consumers. **How to apply:** When in doubt, mark medium; the human reviewer can promote during `git diff` review.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-bootstrap/SKILL.md](.cursor/skills/kb-bootstrap/SKILL.md)
<!-- kk:citations:end -->
