---
type: practice
title: Apply review suggestions bottom-to-top by line number
description: >-
  Sort suggestions by line number descending before applying so earlier edits
  don't invalidate later line references.
tags:
  - self-review
  - suggestions
  - ordering
kk_schema_version: 3
kk_id: practice-apply-review-suggestions-bottom-to-top-by-line-number
kk_derived_from:
  - .opencode/skills/self-review-apply/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
When applying `<suggestion>` elements from a self-review XML file, sort them by line number in descending order before editing. Applying top-to-bottom would shift line numbers of subsequent suggestions as insertions and deletions occur.

Match on the `original-code` text rather than relying solely on line numbers, since the file may have drifted from when the review was authored. Use line numbers only as hints to locate the match.

<!-- kk:citations:start -->
# Citations

[1] [.opencode/skills/self-review-apply/SKILL.md](.opencode/skills/self-review-apply/SKILL.md)
<!-- kk:citations:end -->
