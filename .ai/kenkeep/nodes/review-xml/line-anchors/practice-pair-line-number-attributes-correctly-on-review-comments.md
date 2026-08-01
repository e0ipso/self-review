---
type: practice
title: Pair line-number attributes correctly on review comments
description: >-
  A comment has exactly one pair: new-line-start/end for added/context lines OR
  old-line-start/end for deleted lines. Never both.
tags:
  - self-review
  - xml
  - comments
kk_schema_version: 3
kk_id: practice-pair-line-number-attributes-correctly-on-review-comments
kk_derived_from:
  - .opencode/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
In `review.xml` comments, use `new-line-start`/`new-line-end` for added or context lines, and `old-line-start`/`old-line-end` for deleted lines. Never include both pairs on the same comment.

If neither pair is present, the comment is treated as a file-level comment. See [[self-review-xml-schema]].

<!-- kk:citations:start -->
# Citations

[1] [.opencode/skills/self-review-critique/SKILL.md](.opencode/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
