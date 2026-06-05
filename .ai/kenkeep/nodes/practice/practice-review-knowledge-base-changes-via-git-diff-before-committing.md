---
schema_version: 1
id: practice-review-knowledge-base-changes-via-git-diff-before-committing
title: Review knowledge-base changes via git diff before committing
kind: practice
tags:
  - knowledge-base
  - git
  - review
derived_from:
  - .ai/knowledge-base/README.md
relates_to: []
confidence: high
summary: >-
  Curator and bootstrap writes land directly in nodes/; accept with git commit,
  reject with git restore.
---
All knowledge-base mutations (curate, bootstrap, manual add) write directly to `.ai/knowledge-base/nodes/` and surface as normal file changes in `git status`. The human-in-the-loop step is git itself: inspect with `git diff`, accept by committing, reject with `git restore <file>`.

This applies to curator decisions (`add` creates new files, `modify` rewrites in place), contradictions written under `conflicts/`, and any node produced via `/kb-add` or `npx @e0ipso/ai-knowledge-base node add`.
