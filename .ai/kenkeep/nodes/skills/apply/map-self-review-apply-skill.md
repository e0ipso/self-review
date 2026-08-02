---
type: map
title: self-review-apply skill
description: >-
  Slash command that consumes a v3 review.xml, reads threaded replies in order,
  and applies accepted feedback to the codebase.
tags:
  - self-review
  - skills
  - apply
kk_schema_version: 3
kk_id: map-self-review-apply-skill
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
  - .agents/skills/self-review-apply/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`/self-review-apply` is the consumer counterpart to the self-review critique skill. It reads `review.xml`, treats each comment and its ordered replies as one thread, and applies the feedback to the codebase. The last human reply is the tie-breaker for a thread. The skill owns the canonical schema at `.agents/skills/self-review-apply/assets/self-review-v3.xsd`.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
[2] [.agents/skills/self-review-apply/SKILL.md](.agents/skills/self-review-apply/SKILL.md)
<!-- kk:citations:end -->
