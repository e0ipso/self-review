---
schema_version: 1
id: map-self-review-apply-skill
title: self-review-apply skill
kind: map
tags:
  - self-review
  - skills
  - apply
derived_from:
  - .agents/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  Slash command that consumes a review.xml file and applies its
  suggestions/comments to the codebase.
---
`/self-review-apply` is the consumer counterpart to [[self-review-critique-skill]]. It reads `review.xml` and applies feedback (suggestions, comments) to the codebase. It owns the canonical XSD schema at `.agents/skills/self-review-apply/assets/self-review-v1.xsd`, which defines the review document format used by both skills.
