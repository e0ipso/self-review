---
schema_version: 1
id: practice-line-comments-reference-either-old-or-new-line-numbers-never-both
title: 'Line comments reference either old or new line numbers, never both'
kind: practice
tags:
  - xml
  - comments
  - line-numbers
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  Comments on added/context lines use new-line-start/end; comments on deleted
  lines use old-line-start/end. File-level comments have neither.
---
Comments on added or context lines use `new-line-start` / `new-line-end` (post-change version line numbers). Comments on deleted lines use `old-line-start` / `old-line-end` (pre-change version line numbers).

Exactly one pair should be present for line-level comments; this constraint is enforced by the application (not expressible in XSD 1.0). For single-line comments, start equals end. File-level comments have no line attributes at all.
