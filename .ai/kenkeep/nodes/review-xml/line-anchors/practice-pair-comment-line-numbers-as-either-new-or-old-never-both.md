---
type: practice
title: 'Pair comment line numbers as either new or old, never both'
description: >-
  Self-review comments use exactly one new-line or old-line pair; file-level
  comments have neither.
tags:
  - self-review
  - xml
  - line-numbers
kk_schema_version: 3
kk_id: practice-pair-comment-line-numbers-as-either-new-or-old-never-both
kk_derived_from:
  - .opencode/skills/self-review-apply/SKILL.md
  - .agents/skills/self-review-apply/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
In self-review XML, a comment has exactly one line-number pair: `new-line-start`/`new-line-end` for added or context lines, or `old-line-start`/`old-line-end` for deleted lines. Never include both pairs.

If neither pair is present, the comment is file-level. This rule is enforced by `assets/self-review-v3.xsd` and must be respected by every producer and consumer.

<!-- kk:citations:start -->
# Citations

[1] [.opencode/skills/self-review-apply/SKILL.md](.opencode/skills/self-review-apply/SKILL.md)
[2] [.agents/skills/self-review-apply/SKILL.md](.agents/skills/self-review-apply/SKILL.md)
<!-- kk:citations:end -->
