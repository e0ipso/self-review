---
schema_version: 1
id: practice-never-auto-resolve-contradictions-during-bootstrap
title: Never auto-resolve contradictions during bootstrap
kind: practice
tags:
  - knowledge-base
  - contradictions
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  If two docs disagree, write only one node and surface the conflict in your
  final report — do not write a second contradictory node.
---
Bootstrap should not silently pick a winner when sources disagree.

**Why:** The user is the supervisor and must decide which version is current. **How to apply:** Pick one to write, then call out the conflict explicitly in the final report so the reviewer can resolve it.
