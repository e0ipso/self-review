---
type: practice
title: Extract shared logic before duplicating across call sites
description: >-
  Refactor existing code into reusable utilities before building overlapping
  features; never copy-paste and modify.
tags:
  - strikethroo
  - code-reuse
  - duplication
kk_schema_version: 3
kk_id: practice-extract-shared-logic-before-duplicating-across-call-sites
kk_derived_from:
  - AGENTS.md
kk_relates_to:
  - map-self-review
kk_depends_on: []
kk_confidence: high
---
Strongly favor extracting small, reusable functions and modules over writing similar code in multiple places. When adding a feature that overlaps with existing functionality, refactor the existing code into a reusable abstraction first, then build on top of it. Do not copy-paste and modify. Prefer many small single-purpose functions over large monolithic ones.

**Why:** Drift between near-duplicate implementations is a recurring source of bugs; small focused utilities are also independently testable.

<!-- kk:citations:start -->
# Citations

[1] [AGENTS.md](../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-self-review](../app/map-self-review.md)
<!-- kk:related:end -->
