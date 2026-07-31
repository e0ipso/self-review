---
type: practice
title: Pair line-number attributes correctly in review comments
description: >-
  A comment uses exactly one of new-line-start/end OR old-line-start/end; never
  both. Neither pair means file-level.
tags:
  - self-review
  - xml
  - comments
kk_schema_version: 3
kk_id: practice-pair-line-number-attributes-correctly-in-review-comments
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
In `review.xml` comments, use `new-line-start`/`new-line-end` for added or context lines, and `old-line-start`/`old-line-end` for deleted lines. A comment must carry exactly one of these pairs, never both. A comment without any line attributes is interpreted as a file-level comment.

This pairing rule is enforced by the XSD schema at `.agents/skills/self-review-apply/assets/self-review-v2.xsd` and is the contract between [[self-review-critique-skill]] (producer) and [[self-review-apply-skill]] (consumer).

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
