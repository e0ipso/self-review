---
type: map
title: self-review-apply assistant skill
description: >-
  Bundled AI assistant skill that reads review.xml and applies the feedback to
  the codebase.
tags:
  - skill
  - ai
  - workflow
kk_schema_version: 3
kk_id: map-self-review-apply-assistant-skill
kk_derived_from:
  - README.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
self-review ships with the `self-review-apply` skill located at `.agents/skills/self-review-apply/`, containing `SKILL.md` and `self-review-v2.xsd`. It works with any assistant supporting skill directories (Claude Code, Codex, OpenCode).

Invoked as `/self-review-apply review.xml`, it: "1. Read the XSD schema to understand the review format 2. Parse your review XML 3. Categorize and prioritize comments (security > bug > style > nit) 4. Output a task plan showing parallel and sequential work groups 5. Execute the changes, applying suggestions first, then addressing open-ended feedback."

<!-- kk:citations:start -->
# Citations

[1] [README.md](README.md)
<!-- kk:citations:end -->
