---
type: practice
title: Pair line-number attributes correctly in review comments
description: >-
  Use exactly one complete new-line or old-line pair on line comments; omit both
  pairs for file-level comments.
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
Use `new-line-start`/`new-line-end` for comments on added or context lines, and `old-line-start`/`old-line-end` for comments on deleted lines. A line comment carries exactly one complete pair, never both; a file-level comment carries neither.

The current contract is `.agents/skills/self-review-apply/assets/self-review-v3.xsd` and is shared by the critique producer and apply consumer.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
