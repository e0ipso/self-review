---
schema_version: 1
id: practice-clamp-multi-line-drag-selection-to-a-single-hunk-and-a-single-side
title: Clamp multi-line drag-selection to a single hunk and a single side
kind: practice
tags:
  - drag-select
  - hunks
  - split-view
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  Drag-to-select for comment ranges cannot cross hunk boundaries; in split view
  it's locked to the side where it started.
---
Multi-line comments are created by dragging the `+` gutter icon across lines. Two constraints apply:

1. **Hunk boundary**: selection cannot span across hunk boundaries (`@@` separators). The range is clamped to lines within the same hunk.
2. **Side constraint (split view)**: drag is locked to the side (old/new) where it started; the user cannot drag across sides.

Single-line and multi-line comments share one interaction model and one state (`commentRange`); a click is the degenerate case where start equals end.
