---
schema_version: 1
id: practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed
title: Use <suggestion> blocks whenever a concrete fix can be proposed
kind: practice
tags:
  - self-review
  - suggestions
  - critique
derived_from:
  - .agents/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  For each comment with an actionable fix, include a <suggestion> so the human
  reviewer can accept or reject the change individually.
---
When critiquing, attach a `<suggestion>` (with `<original-code>` and `<proposed-code>`) to every comment where a concrete code change can be proposed. The human reviewer accepts or rejects each suggestion individually in the self-review UI.

**Why:** Suggestions are the unit of mechanically applicable feedback; comments without suggestions become discussion-only items.

**How to apply:** Prefer suggestion-backed comments over prose-only comments whenever the fix is unambiguous.
