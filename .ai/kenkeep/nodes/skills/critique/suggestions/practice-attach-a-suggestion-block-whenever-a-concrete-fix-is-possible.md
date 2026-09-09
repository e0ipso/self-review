---
type: practice
title: Attach a suggestion block whenever a concrete fix is possible
description: >-
  For every critique comment where a fix can be proposed, include a
  `<suggestion>` so the human can accept or reject it individually.
tags:
  - self-review
  - critique
  - suggestions
kk_schema_version: 3
kk_id: practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible
kk_derived_from:
  - .opencode/skills/self-review-critique/SKILL.md
kk_relates_to:
  - map-self-review-critique-skill
kk_depends_on: []
kk_confidence: high
---
The human reviewer evaluates each suggestion independently in self-review. Wherever the critique can propose a concrete replacement, include a `<suggestion>` block with `<original-code>` and `<proposed-code>` instead of leaving the fix as prose.

This provides a concrete replacement for the human to review and for self-review-apply to apply after review.

<!-- kk:citations:start -->
# Citations

[1] [.opencode/skills/self-review-critique/SKILL.md](../../../../../../.opencode/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-self-review-critique-skill](../configuration/map-self-review-critique-skill.md)
<!-- kk:related:end -->
