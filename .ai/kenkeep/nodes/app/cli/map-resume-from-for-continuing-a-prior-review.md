---
type: map
title: '--resume-from for continuing a prior review'
description: >-
  CLI flag that loads a previously exported review XML and overlays comments
  onto the current diff.
tags:
  - resume
  - cli
kk_schema_version: 3
kk_id: map-resume-from-for-continuing-a-prior-review
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`--resume-from <file>` accepts a path to a previously exported XML file. The app parses the XML, runs `git diff` with the provided args to generate the current diff, and launches the window with prior comments overlaid on the diff.

Line numbers may have shifted since the prior review; the app does best-effort context-based matching and marks unmappable comments with `orphaned="true"`. On save, the updated review state is written back out.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
