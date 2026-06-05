---
schema_version: 1
id: practice-pair-comment-line-numbers-as-either-new-or-old-never-both
title: 'Pair comment line numbers as either new or old, never both'
kind: practice
tags:
  - self-review
  - xml
  - line-numbers
derived_from:
  - .opencode/skills/self-review-apply/SKILL.md
relates_to: []
confidence: high
summary: >-
  Self-review comments use exactly one of new-line-start/end or
  old-line-start/end; file-level comments have neither.
---
In the self-review XML format, a comment has exactly one line-number pair: `new-line-start`/`new-line-end` for added or context lines, OR `old-line-start`/`old-line-end` for deleted lines. Never both.

If neither pair is present, the comment is a file-level comment. This rule is enforced by `assets/self-review-v1.xsd` and must be respected by any producer or consumer of the format.
