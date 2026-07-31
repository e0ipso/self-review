---
type: map
title: self-review-critique skill
description: >-
  Slash command that critiques a git diff and emits review.xml for human
  validation via self-review --resume-from.
tags:
  - self-review
  - skills
  - critique
kk_schema_version: 3
kk_id: map-self-review-critique-skill
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`/self-review-critique` is the AI-side counterpart to [[self-review-apply-skill]]. It runs `git diff $ARGUMENTS`, reads file context, generates structured comments and suggestions, and writes a `review.xml` file. The human then loads the critique in the self-review desktop app with `self-review <args> --resume-from review.xml`.

Lives at `.agents/skills/self-review-critique/SKILL.md`. Reads `.self-review.yaml` for category configuration when present.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
