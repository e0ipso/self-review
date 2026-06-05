---
schema_version: 1
id: map-self-review-critique-skill
title: self-review-critique skill
kind: map
tags:
  - self-review
  - skills
  - critique
derived_from:
  - .agents/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  Slash command that critiques a git diff and emits review.xml for human
  validation via self-review --resume-from.
---
`/self-review-critique` is the AI-side counterpart to [[self-review-apply-skill]]. It runs `git diff $ARGUMENTS`, reads file context, generates structured comments and suggestions, and writes a `review.xml` file. The human then loads the critique in the self-review desktop app with `self-review <args> --resume-from review.xml`.

Lives at `.agents/skills/self-review-critique/SKILL.md`. Reads `.self-review.yaml` for category configuration when present.
