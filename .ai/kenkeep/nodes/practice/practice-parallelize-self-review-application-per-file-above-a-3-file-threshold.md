---
schema_version: 1
id: practice-parallelize-self-review-application-per-file-above-a-3-file-threshold
title: Parallelize self-review application per file above a 3-file threshold
kind: practice
tags:
  - self-review
  - workflow
  - subagents
derived_from:
  - .opencode/skills/self-review-apply/SKILL.md
relates_to: []
confidence: medium
summary: >-
  For reviews with >3 commented files, spawn one subagent per file; for ≤3,
  apply changes directly.
---
When applying self-review feedback, create one TaskCreate task per file that has comments and spawn subagents to work on independent files concurrently. For small reviews of 3 or fewer files with comments, skip the subagent overhead and apply changes directly in the main agent.

Skip files with zero comments entirely — they require no work. Complete all changes for one file before moving to the next to keep edits coherent.
