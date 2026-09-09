---
type: map
title: POST_PHASE hook
description: >-
  Create a phase commit and update blueprint progress before advancing.
tags:
  - hooks
  - workflow
  - strikethroo
kk_schema_version: 3
kk_id: map-post-phase-hook
kk_derived_from:
  - .ai/strikethroo/config/hooks/POST_PHASE.md
kk_relates_to:
  - practice-follow-the-allowed-task-status-transitions
  - practice-mark-completed-phases-and-tasks-in-the-blueprint-before-advancing
  - practice-pass-linting-and-create-a-descriptive-conventional-commit-at-the-end-of-each-phase
kk_depends_on: []
kk_confidence: high
---
The hook at `.ai/strikethroo/config/hooks/POST_PHASE.md` requires a descriptive conventional commit for the phase and updates to phase/task completion markers. Run lint or formatting commands if the hook defines them; the current hook defines no concrete lint command. Follow the documented pending/in-progress/completed/failed transitions.

<!-- kk:citations:start -->
# Citations

[1] [.ai/strikethroo/config/hooks/POST_PHASE.md](../../../../strikethroo/config/hooks/POST_PHASE.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [practice-follow-the-allowed-task-status-transitions](practice-follow-the-allowed-task-status-transitions.md)
- Related: [practice-mark-completed-phases-and-tasks-in-the-blueprint-before-advancing](practice-mark-completed-phases-and-tasks-in-the-blueprint-before-advancing.md)
- Related: [practice-pass-linting-and-create-a-descriptive-conventional-commit-at-the-end-of-each-phase](practice-pass-linting-and-create-a-descriptive-conventional-commit-at-the-end-of-each-phase.md)
<!-- kk:related:end -->
