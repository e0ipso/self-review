---
schema_version: 1
id: practice-set-author-to-your-model-name-on-every-generated-comment
title: Set author to your model name on every generated comment
kind: practice
tags:
  - self-review
  - attribution
  - critique
derived_from:
  - .agents/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  AI-generated comments in review.xml carry an author attribute with the model
  name (e.g., "Claude Sonnet 4.6"); absence means human reviewer.
---
Every `<comment>` produced by [[self-review-critique-skill]] must include an `author` attribute set to the model name (e.g., `author="Claude Sonnet 4.6"`).

**Why:** The self-review UI distinguishes AI-authored comments from human comments. When `author` is absent, the UI shows "You" with a person icon (human reviewer).

**How to apply:** Include the attribute on every comment, including file-level ones, when emitting critique output.
