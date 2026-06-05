---
schema_version: 1
id: practice-default-node-confidence-to-medium-during-bootstrap
title: Default node confidence to medium during bootstrap
kind: practice
tags:
  - knowledge-base
  - confidence
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  Use `confidence: medium` for bootstrap content by default; reserve `high` for
  explicitly-stated, actively-maintained docs.
---
Existing docs may be stale or aspirational, so the reviewer needs to assess each one. Use `confidence: high` only when the doc explicitly states the rule with rationale and the doc looks actively maintained.

**Why:** Overstated confidence misleads downstream consumers. **How to apply:** When in doubt, mark medium; the human reviewer can promote during `git diff` review.
