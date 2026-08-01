---
type: map
title: Default critique categories
description: >-
  Six built-in comment categories used when .self-review.yaml is absent:
  question, bug, security, style, task, nit.
tags:
  - self-review
  - categories
  - critique
kk_schema_version: 3
kk_id: map-default-critique-categories
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
When no `.self-review.yaml` is present, the critique skill uses these defaults:

- `question` — clarification needed
- `bug` — likely defect or incorrect behavior
- `security` — security vulnerability or concern
- `style` — code style, naming, or formatting issue
- `task` — action item or follow-up
- `nit` — minor nitpick, low priority

Use these names as `<category>` values in comments unless the project overrides via [[self-review-yaml-config]].

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
