---
type: map
title: '--resume-from for continuing a prior review'
description: >-
  Resume overlays recorded comments and viewed state; line remapping is not
  implemented.
tags:
  - resume
  - cli
kk_schema_version: 3
kk_id: map-resume-from-for-continuing-a-prior-review
kk_derived_from:
  - docs/PRD.md
kk_relates_to:
  - map-self-review-cli-invocations
kk_depends_on: []
kk_confidence: high
---
`--resume-from <file>` loads comments and viewed state from an existing XML document over the current diff. Current loading overlays recorded line anchors directly; it does not perform context-based remapping. Comments whose lines disappeared can remain in review state without appearing in the line view. The PRD requires orphan detection and visible presentation, but that behavior is not fully implemented. See `src/main/main.ts` and `packages/react/src/components/DiffViewer/FileSection.tsx`.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](../../../../../docs/PRD.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-self-review-cli-invocations](map-self-review-cli-invocations.md)
<!-- kk:related:end -->
