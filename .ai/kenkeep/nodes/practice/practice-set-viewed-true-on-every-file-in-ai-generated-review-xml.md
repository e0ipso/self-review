---
schema_version: 1
id: practice-set-viewed-true-on-every-file-in-ai-generated-review-xml
title: Set `viewed="true"` on every file in AI-generated review.xml
kind: practice
tags:
  - self-review
  - xml
  - attributes
derived_from:
  - .opencode/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  When the critique skill emits review.xml, mark every `<file>` element with
  `viewed="true"` since the AI "viewed" them all.
---
The `viewed` attribute on `<file>` elements must be set to `"true"` for every file in the AI-generated `review.xml`. This represents that the assistant processed each file during critique.

Applies to both files with comments and files without comments (self-closing `<file ... />`).
