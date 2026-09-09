---
type: practice
title: >-
  Complete configured checks and commit each phase
description: >-
  Run checks defined by the phase hook and create a descriptive conventional
  commit.
tags:
  - workflow
  - linting
  - commits
kk_schema_version: 3
kk_id: >-
  practice-pass-linting-and-create-a-descriptive-conventional-commit-at-the-end-of-each-phase
kk_derived_from:
  - .ai/strikethroo/config/hooks/POST_PHASE.md
kk_relates_to:
  - map-post-phase-hook
kk_depends_on: []
kk_confidence: high
---
Before advancing, run lint or format checks when the project POST_PHASE hook defines them. If it defines none, skip that hook step. Create a descriptive conventional commit with subject and body, and update blueprint completion markers. Other workflow validation requirements still apply.

<!-- kk:citations:start -->
# Citations

[1] [.ai/strikethroo/config/hooks/POST_PHASE.md](../../../../strikethroo/config/hooks/POST_PHASE.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-post-phase-hook](map-post-phase-hook.md)
<!-- kk:related:end -->
