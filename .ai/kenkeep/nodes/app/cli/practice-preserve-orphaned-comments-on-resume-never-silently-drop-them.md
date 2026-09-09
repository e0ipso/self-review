---
type: practice
title: Preserve orphaned comments on resume; never silently drop them
description: >-
  Preserve and expose unmatched prior comments; complete orphan handling remains
  a PRD requirement.
tags:
  - resume
  - comments
  - data-integrity
kk_schema_version: 3
kk_id: practice-preserve-orphaned-comments-on-resume-never-silently-drop-them
kk_derived_from:
  - docs/PRD.md
kk_relates_to:
  - map-self-review-cli-invocations
kk_depends_on: []
kk_confidence: high
---
Preserve prior comments when the current diff no longer contains their anchors. The PRD requires unmappable comments to carry `orphaned="true"` and appear at the top of the file. This is a required behavior, not a guarantee of the current implementation: resume currently overlays recorded anchors directly and lacks complete orphan reconciliation. Context-based remapping remains an open PRD design question.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](../../../../../docs/PRD.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-self-review-cli-invocations](map-self-review-cli-invocations.md)
<!-- kk:related:end -->
