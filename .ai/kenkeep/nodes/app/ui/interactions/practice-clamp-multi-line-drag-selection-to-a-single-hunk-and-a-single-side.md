---
type: practice
title: Clamp multi-line drag-selection to a single hunk and a single side
description: >-
  Drag-to-select for comment ranges cannot cross hunk boundaries; in split view
  it's locked to the side where it started.
tags:
  - drag-select
  - hunks
  - split-view
kk_schema_version: 3
kk_id: practice-clamp-multi-line-drag-selection-to-a-single-hunk-and-a-single-side
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Multi-line comments are created by dragging the `+` gutter icon across lines. Two constraints apply:

1. **Hunk boundary**: selection cannot span across hunk boundaries (`@@` separators). The range is clamped to lines within the same hunk.
2. **Side constraint (split view)**: drag is locked to the side (old/new) where it started; the user cannot drag across sides.

Single-line and multi-line comments share one interaction model and one state (`commentRange`); a click is the degenerate case where start equals end.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
