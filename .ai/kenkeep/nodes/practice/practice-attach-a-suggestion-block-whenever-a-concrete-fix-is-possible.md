---
schema_version: 1
id: practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible
title: Attach a suggestion block whenever a concrete fix is possible
kind: practice
tags:
  - self-review
  - critique
  - suggestions
derived_from:
  - .opencode/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  For every critique comment where a fix can be proposed, include a
  `<suggestion>` so the human can accept or reject it individually.
---
The human reviewer evaluates each suggestion independently in self-review. Wherever the critique can propose a concrete replacement, include a `<suggestion>` block with `<original-code>` and `<proposed-code>` instead of leaving the fix as prose.

This maximizes the actionability of the critique and lets the reviewer apply fixes with one click.
