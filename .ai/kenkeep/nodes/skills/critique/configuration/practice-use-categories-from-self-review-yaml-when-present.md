---
type: practice
title: Use categories from .self-review.yaml when present
description: >-
  If `.self-review.yaml` exists with a `categories` array, use only those
  category names. Otherwise, fall back to the documented defaults.
tags:
  - self-review
  - critique
  - categories
kk_schema_version: 3
kk_id: practice-use-categories-from-self-review-yaml-when-present
kk_derived_from:
  - .opencode/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Before generating comments, check for `.self-review.yaml` in the working directory. If it defines `categories`, every comment's `<category>` must use one of those names.

When no config exists, use the default categories: `question`, `bug`, `security`, `style`, `task`, `nit`.

<!-- kk:citations:start -->
# Citations

[1] [.opencode/skills/self-review-critique/SKILL.md](.opencode/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
