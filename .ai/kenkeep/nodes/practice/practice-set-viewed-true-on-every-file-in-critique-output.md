---
schema_version: 1
id: practice-set-viewed-true-on-every-file-in-critique-output
title: Set viewed="true" on every file in critique output
kind: practice
tags:
  - self-review
  - xml
  - critique
derived_from:
  - .agents/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  When generating review.xml from /self-review-critique, mark all files with
  viewed="true" since the assistant "viewed" them all.
---
Every `<file>` element in the generated `review.xml` must have `viewed="true"`. The rationale stated in the skill: "the assistant 'viewed' them all".

**Why:** Differentiates the critique workflow from a human reviewer's progressive review where only some files are marked viewed.

**How to apply:** When emitting XML from [[self-review-critique-skill]], unconditionally set `viewed="true"` on every file, regardless of whether the file generated any comments.
