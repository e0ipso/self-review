---
schema_version: 1
id: map-default-critique-categories
title: Default critique categories
kind: map
tags:
  - self-review
  - categories
  - critique
derived_from:
  - .agents/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  Six built-in comment categories used when .self-review.yaml is absent:
  question, bug, security, style, task, nit.
---
When no `.self-review.yaml` is present, the critique skill uses these defaults:

- `question` — clarification needed
- `bug` — likely defect or incorrect behavior
- `security` — security vulnerability or concern
- `style` — code style, naming, or formatting issue
- `task` — action item or follow-up
- `nit` — minor nitpick, low priority

Use these names as `<category>` values in comments unless the project overrides via [[self-review-yaml-config]].
