---
type: practice
title: Use <suggestion> blocks whenever a concrete fix can be proposed
description: >-
  For each comment with an actionable fix, include a <suggestion> so the human
  reviewer can accept or reject the change individually.
tags:
  - self-review
  - suggestions
  - critique
kk_schema_version: 3
kk_id: practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
When critiquing, attach a `<suggestion>` (with `<original-code>` and `<proposed-code>`) to every comment where a concrete code change can be proposed. The human reviewer accepts or rejects each suggestion individually in the self-review UI.

**Why:** Suggestions are the unit of mechanically applicable feedback; comments without suggestions become discussion-only items.

**How to apply:** Prefer suggestion-backed comments over prose-only comments whenever the fix is unambiguous.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
