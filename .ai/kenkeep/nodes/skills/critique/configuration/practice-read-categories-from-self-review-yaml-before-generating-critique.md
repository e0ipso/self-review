---
type: practice
title: Read categories from .self-review.yaml before generating critique
description: >-
  If .self-review.yaml exists, use only its declared categories; otherwise fall
  back to the six built-in defaults.
tags:
  - self-review
  - critique
  - categories
kk_schema_version: 3
kk_id: practice-read-categories-from-self-review-yaml-before-generating-critique
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Before emitting comments, check for `.self-review.yaml` in the current directory. If present, restrict the `<category>` values to the names declared in its `categories` array, and honor its `output-file` setting (default `./review.xml`).

If the config is absent, fall back to the built-in defaults: `question`, `bug`, `security`, `style`, `task`, `nit`. See [[default-critique-categories]].

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
