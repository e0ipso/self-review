---
type: map
title: self-review XML schema (self-review-v3.xsd)
description: >-
  The v3 XSD beside self-review-apply defines review metadata, files, comments,
  suggestions, attachments, and ordered replies.
tags:
  - self-review
  - xsd
  - schema
kk_schema_version: 3
kk_id: map-self-review-xml-schema-self-review-v1-xsd
kk_derived_from:
  - .opencode/skills/self-review-apply/SKILL.md
  - .agents/skills/self-review-apply/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The live self-review XML format is defined by `assets/self-review-v3.xsd` beside the `self-review-apply` skill. It covers git and directory source metadata, file change types and viewed state, comment line-number pairing, suggestions, attachments, and ordered flat replies.

For renamed files, `path` holds the new path. Replies contain a body, optional author, and optional attachments; they do not carry category, severity, confidence, or suggestions.

<!-- kk:citations:start -->
# Citations

[1] [.opencode/skills/self-review-apply/SKILL.md](.opencode/skills/self-review-apply/SKILL.md)
[2] [.agents/skills/self-review-apply/SKILL.md](.agents/skills/self-review-apply/SKILL.md)
<!-- kk:citations:end -->
