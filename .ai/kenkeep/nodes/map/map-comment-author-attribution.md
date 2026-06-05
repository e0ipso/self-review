---
schema_version: 1
id: map-comment-author-attribution
title: Comment author attribution
kind: map
tags:
  - task-manager
  - comments
  - author
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  Critique-generated comments include an author attribute (model name); absent
  author shows 'You' with a person icon.
---
Comments from the `self-review-critique` skill include an `author` attribute with the model name. When the attribute is absent, the UI shows 'You' with a person icon to indicate a human reviewer. This distinguishes AI-generated critique from human comments in the same review file.
