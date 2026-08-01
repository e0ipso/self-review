---
type: practice
title: Set `viewed="true"` on every file in AI-generated review.xml
description: >-
  When the critique skill emits review.xml, mark every `<file>` element with
  `viewed="true"` since the AI "viewed" them all.
tags:
  - self-review
  - xml
  - attributes
kk_schema_version: 3
kk_id: practice-set-viewed-true-on-every-file-in-ai-generated-review-xml
kk_derived_from:
  - .opencode/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The `viewed` attribute on `<file>` elements must be set to `"true"` for every file in the AI-generated `review.xml`. This represents that the assistant processed each file during critique.

Applies to both files with comments and files without comments (self-closing `<file ... />`).

<!-- kk:citations:start -->
# Citations

[1] [.opencode/skills/self-review-critique/SKILL.md](.opencode/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
