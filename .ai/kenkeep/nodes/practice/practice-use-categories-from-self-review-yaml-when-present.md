---
schema_version: 1
id: practice-use-categories-from-self-review-yaml-when-present
title: Use categories from .self-review.yaml when present
kind: practice
tags:
  - self-review
  - critique
  - categories
derived_from:
  - .opencode/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  If `.self-review.yaml` exists with a `categories` array, use only those
  category names. Otherwise, fall back to the documented defaults.
---
Before generating comments, check for `.self-review.yaml` in the working directory. If it defines `categories`, every comment's `<category>` must use one of those names.

When no config exists, use the default categories: `question`, `bug`, `security`, `style`, `task`, `nit`.
