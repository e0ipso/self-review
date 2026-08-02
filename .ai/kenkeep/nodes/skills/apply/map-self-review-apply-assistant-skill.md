---
type: map
title: self-review-apply assistant skill
description: >-
  Bundled assistant skill that validates v3 review.xml feedback, reads reply
  threads, and applies the accepted comments.
tags:
  - skill
  - ai
  - workflow
kk_schema_version: 3
kk_id: map-self-review-apply-assistant-skill
kk_derived_from:
  - README.md
  - .agents/skills/self-review-apply/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
self-review ships with the `self-review-apply` skill at `.agents/skills/self-review-apply/`, containing `SKILL.md` and the canonical `assets/self-review-v3.xsd`. It works with assistants that support skill directories.

Invoked with a review XML path, it validates the document, loads the reviewed diff, reads each thread in document order, applies every accepted comment by default, and verifies the resulting changes. Optional severity and confidence floors support unattended use.

<!-- kk:citations:start -->
# Citations

[1] [README.md](README.md)
[2] [.agents/skills/self-review-apply/SKILL.md](.agents/skills/self-review-apply/SKILL.md)
<!-- kk:citations:end -->
