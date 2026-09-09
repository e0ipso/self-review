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
kk_relates_to:
  - map-self-review-apply-assistant-skill
  - practice-apply-review-suggestions-bottom-to-top-by-line-number
  - practice-convert-v2-gate-reviews-to-v3-before-applying
  - practice-load-the-original-diff-context-before-applying-review-feedback
  - practice-parallelize-self-review-application-per-file-above-a-3-file-threshold
  - practice-treat-every-review-comment-as-actionable-including-questions
  - practice-validate-self-review-xml-against-the-xsd-before-applying
  - map-self-review-critique-skill
kk_depends_on: []
kk_confidence: high
---
`/self-review-apply` is the consumer counterpart to the self-review critique skill. It reads `review.xml`, treats each comment and its ordered replies as one thread, and applies the feedback to the codebase. The last human reply is the tie-breaker for a thread. The skill owns the canonical schema at `.agents/skills/self-review-apply/assets/self-review-v3.xsd`.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](../../../../../.agents/skills/self-review-critique/SKILL.md)
[2] [.agents/skills/self-review-apply/SKILL.md](../../../../../.agents/skills/self-review-apply/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-self-review-apply-assistant-skill](map-self-review-apply-assistant-skill.md)
- Related: [practice-apply-review-suggestions-bottom-to-top-by-line-number](practice-apply-review-suggestions-bottom-to-top-by-line-number.md)
- Related: [practice-convert-v2-gate-reviews-to-v3-before-applying](practice-convert-v2-gate-reviews-to-v3-before-applying.md)
- Related: [practice-load-the-original-diff-context-before-applying-review-feedback](practice-load-the-original-diff-context-before-applying-review-feedback.md)
- Related: [practice-parallelize-self-review-application-per-file-above-a-3-file-threshold](practice-parallelize-self-review-application-per-file-above-a-3-file-threshold.md)
- Related: [practice-treat-every-review-comment-as-actionable-including-questions](practice-treat-every-review-comment-as-actionable-including-questions.md)
- Related: [practice-validate-self-review-xml-against-the-xsd-before-applying](practice-validate-self-review-xml-against-the-xsd-before-applying.md)
- Related: [map-self-review-critique-skill](../critique/configuration/map-self-review-critique-skill.md)
<!-- kk:related:end -->
