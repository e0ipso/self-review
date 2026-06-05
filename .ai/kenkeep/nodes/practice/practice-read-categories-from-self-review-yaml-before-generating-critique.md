---
schema_version: 1
id: practice-read-categories-from-self-review-yaml-before-generating-critique
title: Read categories from .self-review.yaml before generating critique
kind: practice
tags:
  - self-review
  - critique
  - categories
derived_from:
  - .agents/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  If .self-review.yaml exists, use only its declared categories; otherwise fall
  back to the six built-in defaults.
---
Before emitting comments, check for `.self-review.yaml` in the current directory. If present, restrict the `<category>` values to the names declared in its `categories` array, and honor its `output-file` setting (default `./review.xml`).

If the config is absent, fall back to the built-in defaults: `question`, `bug`, `security`, `style`, `task`, `nit`. See [[default-critique-categories]].
