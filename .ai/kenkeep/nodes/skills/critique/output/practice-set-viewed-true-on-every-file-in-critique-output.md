---
type: practice
title: Set viewed="true" on every file in critique output
description: >-
  When generating review.xml from /self-review-critique, mark all files with
  viewed="true" since the assistant "viewed" them all.
tags:
  - self-review
  - xml
  - critique
kk_schema_version: 3
kk_id: practice-set-viewed-true-on-every-file-in-critique-output
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Every `<file>` element in the generated `review.xml` must have `viewed="true"`. The rationale stated in the skill: "the assistant 'viewed' them all".

**Why:** Differentiates the critique workflow from a human reviewer's progressive review where only some files are marked viewed.

**How to apply:** When emitting XML from [[self-review-critique-skill]], unconditionally set `viewed="true"` on every file, regardless of whether the file generated any comments.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
