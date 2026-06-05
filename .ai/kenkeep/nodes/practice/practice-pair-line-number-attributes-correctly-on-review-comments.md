---
schema_version: 1
id: practice-pair-line-number-attributes-correctly-on-review-comments
title: Pair line-number attributes correctly on review comments
kind: practice
tags:
  - self-review
  - xml
  - comments
derived_from:
  - .opencode/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  A comment has exactly one pair: new-line-start/end for added/context lines OR
  old-line-start/end for deleted lines. Never both.
---
In `review.xml` comments, use `new-line-start`/`new-line-end` for added or context lines, and `old-line-start`/`old-line-end` for deleted lines. Never include both pairs on the same comment.

If neither pair is present, the comment is treated as a file-level comment. See [[self-review-xml-schema]].
