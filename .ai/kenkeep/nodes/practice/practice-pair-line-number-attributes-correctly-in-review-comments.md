---
schema_version: 1
id: practice-pair-line-number-attributes-correctly-in-review-comments
title: Pair line-number attributes correctly in review comments
kind: practice
tags:
  - self-review
  - xml
  - comments
derived_from:
  - .agents/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  A comment uses exactly one of new-line-start/end OR old-line-start/end; never
  both. Neither pair means file-level.
---
In `review.xml` comments, use `new-line-start`/`new-line-end` for added or context lines, and `old-line-start`/`old-line-end` for deleted lines. A comment must carry exactly one of these pairs, never both. A comment without any line attributes is interpreted as a file-level comment.

This pairing rule is enforced by the XSD schema at `.agents/skills/self-review-apply/assets/self-review-v1.xsd` and is the contract between [[self-review-critique-skill]] (producer) and [[self-review-apply-skill]] (consumer).
