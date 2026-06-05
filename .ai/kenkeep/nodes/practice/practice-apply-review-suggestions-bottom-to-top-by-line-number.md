---
schema_version: 1
id: practice-apply-review-suggestions-bottom-to-top-by-line-number
title: Apply review suggestions bottom-to-top by line number
kind: practice
tags:
  - self-review
  - suggestions
  - ordering
derived_from:
  - .opencode/skills/self-review-apply/SKILL.md
relates_to: []
confidence: high
summary: >-
  Sort suggestions by line number descending before applying so earlier edits
  don't invalidate later line references.
---
When applying `<suggestion>` elements from a self-review XML file, sort them by line number in descending order before editing. Applying top-to-bottom would shift line numbers of subsequent suggestions as insertions and deletions occur.

Match on the `original-code` text rather than relying solely on line numbers, since the file may have drifted from when the review was authored. Use line numbers only as hints to locate the match.
