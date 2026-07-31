---
type: map
title: self-review-apply skill
description: >-
  Slash command that consumes a review.xml file and applies its
  suggestions/comments to the codebase.
tags:
  - self-review
  - skills
  - apply
kk_schema_version: 3
kk_id: map-self-review-apply-skill
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`/self-review-apply` is the consumer counterpart to [[self-review-critique-skill]]. It reads `review.xml` and applies feedback (suggestions, comments) to the codebase. It owns the canonical XSD schema at `.agents/skills/self-review-apply/assets/self-review-v2.xsd`, which defines the review document format used by both skills.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
