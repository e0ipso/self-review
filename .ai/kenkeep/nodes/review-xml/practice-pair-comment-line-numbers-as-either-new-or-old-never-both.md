---
type: practice
title: 'Pair comment line numbers as either new or old, never both'
description: >-
  Self-review comments use exactly one of new-line-start/end or
  old-line-start/end; file-level comments have neither.
tags:
  - self-review
  - xml
  - line-numbers
kk_schema_version: 3
kk_id: practice-pair-comment-line-numbers-as-either-new-or-old-never-both
kk_derived_from:
  - .opencode/skills/self-review-apply/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
In the self-review XML format, a comment has exactly one line-number pair: `new-line-start`/`new-line-end` for added or context lines, OR `old-line-start`/`old-line-end` for deleted lines. Never both.

If neither pair is present, the comment is a file-level comment. This rule is enforced by `assets/self-review-v2.xsd` and must be respected by any producer or consumer of the format.

<!-- kk:citations:start -->
# Citations

[1] [.opencode/skills/self-review-apply/SKILL.md](.opencode/skills/self-review-apply/SKILL.md)
<!-- kk:citations:end -->
