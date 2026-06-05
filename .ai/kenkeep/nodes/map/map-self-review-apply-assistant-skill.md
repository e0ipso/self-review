---
schema_version: 1
id: map-self-review-apply-assistant-skill
title: self-review-apply assistant skill
kind: map
tags:
  - skill
  - ai
  - workflow
derived_from:
  - README.md
relates_to: []
confidence: high
summary: >-
  Bundled AI assistant skill that reads review.xml and applies the feedback to
  the codebase.
---
self-review ships with the `self-review-apply` skill located at `.agents/skills/self-review-apply/`, containing `SKILL.md` and `self-review-v1.xsd`. It works with any assistant supporting skill directories (Claude Code, Codex, OpenCode).

Invoked as `/self-review-apply review.xml`, it: "1. Read the XSD schema to understand the review format 2. Parse your review XML 3. Categorize and prioritize comments (security > bug > style > nit) 4. Output a task plan showing parallel and sequential work groups 5. Execute the changes, applying suggestions first, then addressing open-ended feedback."
