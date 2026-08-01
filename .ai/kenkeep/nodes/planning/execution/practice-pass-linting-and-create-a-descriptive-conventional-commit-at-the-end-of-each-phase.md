---
type: practice
title: >-
  Pass linting and create a descriptive conventional commit at the end of each
  phase
description: >-
  Before moving to the next phase, ensure linting passes and a
  conventional-commit (subject + description) is created for the phase.
tags:
  - workflow
  - linting
  - commits
kk_schema_version: 3
kk_id: >-
  practice-pass-linting-and-create-a-descriptive-conventional-commit-at-the-end-of-each-phase
kk_derived_from:
  - .ai/task-manager/config/hooks/POST_PHASE.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
At the end of each phase, the codebase must pass linting requirements, and a descriptive commit using conventional commits (with both a subject and a description) must be successfully created for that phase.

This is the POST_PHASE hook contract: linting compliance and a phase-scoped conventional commit are the gating conditions before progressing.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/hooks/POST_PHASE.md](.ai/task-manager/config/hooks/POST_PHASE.md)
<!-- kk:citations:end -->
