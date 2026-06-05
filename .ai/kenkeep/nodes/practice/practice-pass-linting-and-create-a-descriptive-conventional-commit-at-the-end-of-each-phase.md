---
schema_version: 1
id: >-
  practice-pass-linting-and-create-a-descriptive-conventional-commit-at-the-end-of-each-phase
title: >-
  Pass linting and create a descriptive conventional commit at the end of each
  phase
kind: practice
tags:
  - workflow
  - linting
  - commits
derived_from:
  - .ai/task-manager/config/hooks/POST_PHASE.md
relates_to: []
confidence: high
summary: >-
  Before moving to the next phase, ensure linting passes and a
  conventional-commit (subject + description) is created for the phase.
---
At the end of each phase, the codebase must pass linting requirements, and a descriptive commit using conventional commits (with both a subject and a description) must be successfully created for that phase.

This is the POST_PHASE hook contract: linting compliance and a phase-scoped conventional commit are the gating conditions before progressing.
