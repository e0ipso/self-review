---
schema_version: 1
id: practice-stop-and-ask-the-user-when-bootstrap-conditions-go-off-track
title: Stop and ask the user when bootstrap conditions go off-track
kind: practice
tags:
  - knowledge-base
  - escalation
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  Pause and consult the user if docs exceed ~100 files, content is
  contentious/version-specific, you're over-extracting, or confidence drops
  without correction.
---
Bootstrap is supervised — defer to the human when uncertain. Specific stop conditions:

- The docs directory contains more than ~100 markdown files (likely needs scoping).
- A doc is clearly contentious or version-specific and you can't tell which version is current.
- Nodes pile up faster than the user can plausibly review.
- The user has not corrected you in a while but your confidence is dropping.
