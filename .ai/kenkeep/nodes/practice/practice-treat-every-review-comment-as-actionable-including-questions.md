---
schema_version: 1
id: practice-treat-every-review-comment-as-actionable-including-questions
title: 'Treat every review comment as actionable, including questions'
kind: practice
tags:
  - self-review
  - comments
  - questions
derived_from:
  - .opencode/skills/self-review-apply/SKILL.md
relates_to: []
confidence: high
summary: >-
  Question-category comments often imply a code change is needed; answer purely
  informational ones in the summary.
---
When applying self-review feedback, do not skip comments based on category. Every category is actionable — including `question`, which frequently implies a change is needed even when phrased as an inquiry.

If a question is purely informational and warrants no code change, answer it in the final Questions & Answers summary section and mark it `No change`. Otherwise implement the change and mark it `Changed`.
