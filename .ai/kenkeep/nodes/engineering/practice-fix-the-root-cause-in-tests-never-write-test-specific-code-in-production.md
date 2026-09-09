---
type: practice
title: 'Fix the root cause in tests, never write test-specific code in production'
description: >-
  No environment detection, no conditional test bypasses; green tests must mean
  the code actually works.
tags:
  - strikethroo
  - testing
  - root-cause
kk_schema_version: 3
kk_id: >-
  practice-fix-the-root-cause-in-tests-never-write-test-specific-code-in-production
kk_derived_from:
  - AGENTS.md
kk_relates_to:
  - map-self-review
kk_depends_on: []
kk_confidence: high
---
Never write test-specific code in production source files. Never use environment detection to make tests pass. Never create conditional logic that masks real issues in tests. Green tests must mean the underlying code actually works correctly. Fix the root cause, not the test symptoms.

**Why:** Tests that pass only via production-side hacks provide false confidence and hide real defects.

<!-- kk:citations:start -->
# Citations

[1] [AGENTS.md](../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-self-review](../app/map-self-review.md)
<!-- kk:related:end -->
