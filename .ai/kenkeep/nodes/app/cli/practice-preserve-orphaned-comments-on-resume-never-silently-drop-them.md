---
type: practice
title: Preserve orphaned comments on resume; never silently drop them
description: >-
  Comments from a resumed review that can't be mapped to current lines get
  orphaned="true" and a visual indicator, never deleted.
tags:
  - resume
  - comments
  - data-integrity
kk_schema_version: 3
kk_id: practice-preserve-orphaned-comments-on-resume-never-silently-drop-them
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
With `--resume-from`, line numbers from a prior review may no longer match the current diff. The app attempts best-effort matching using surrounding context (similar to git rename detection).

Comments that cannot be mapped to any current line are preserved in the output with an `orphaned="true"` attribute and displayed at the top of the relevant file section with a visual indicator. Prior comments are never silently dropped.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
