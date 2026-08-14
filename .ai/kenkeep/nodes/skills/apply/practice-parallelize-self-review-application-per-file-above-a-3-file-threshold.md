---
type: practice
title: Parallelize self-review application per file above a 3-file threshold
description: >-
  For reviews with >3 commented files, spawn one subagent per file; for ≤3,
  apply changes directly.
tags:
  - self-review
  - workflow
  - subagents
kk_schema_version: 3
kk_id: practice-parallelize-self-review-application-per-file-above-a-3-file-threshold
kk_derived_from:
  - .opencode/skills/self-review-apply/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: medium
---
When applying self-review feedback, create one TaskCreate task per file that has comments and spawn subagents to work on independent files concurrently. For small reviews of 3 or fewer files with comments, skip the subagent overhead and apply changes directly in the main agent.

Skip files with zero comments entirely — they require no work. Complete all changes for one file before moving to the next to keep edits coherent.

<!-- kk:citations:start -->
# Citations

[1] [.opencode/skills/self-review-apply/SKILL.md](.opencode/skills/self-review-apply/SKILL.md)
<!-- kk:citations:end -->
