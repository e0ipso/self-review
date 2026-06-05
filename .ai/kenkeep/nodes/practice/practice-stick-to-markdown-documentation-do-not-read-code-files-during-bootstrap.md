---
schema_version: 1
id: >-
  practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap
title: Stick to markdown documentation; do not read code files during bootstrap
kind: practice
tags:
  - knowledge-base
  - scope
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  Bootstrap extracts what's already been written down — read only markdown docs,
  not source code.
---
The point of bootstrap is to extract pre-existing written knowledge. Reading code expands scope beyond what the user is supervising.

**Why:** Bootstrap is supervised and one-pass; pulling in code-derived inferences blurs the boundary between what's documented and what you guessed. **How to apply:** Limit reads to markdown files surfaced by the CLI's dry-run listing.
