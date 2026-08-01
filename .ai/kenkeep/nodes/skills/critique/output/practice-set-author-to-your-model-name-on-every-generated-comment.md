---
type: practice
title: Set author to your model name on every generated comment
description: >-
  AI-generated comments in review.xml carry an author attribute with the model
  name (e.g., "Claude Sonnet 4.6"); absence means human reviewer.
tags:
  - self-review
  - attribution
  - critique
kk_schema_version: 3
kk_id: practice-set-author-to-your-model-name-on-every-generated-comment
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Every `<comment>` produced by [[self-review-critique-skill]] must include an `author` attribute set to the model name (e.g., `author="Claude Sonnet 4.6"`).

**Why:** The self-review UI distinguishes AI-authored comments from human comments. When `author` is absent, the UI shows "You" with a person icon (human reviewer).

**How to apply:** Include the attribute on every comment, including file-level ones, when emitting critique output.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
