---
schema_version: 1
id: map-resume-from-for-continuing-a-prior-review
title: '--resume-from for continuing a prior review'
kind: map
tags:
  - resume
  - cli
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  CLI flag that loads a previously exported review XML and overlays comments
  onto the current diff.
---
`--resume-from <file>` accepts a path to a previously exported XML file. The app parses the XML, runs `git diff` with the provided args to generate the current diff, and launches the window with prior comments overlaid on the diff.

Line numbers may have shifted since the prior review; the app does best-effort context-based matching and marks unmappable comments with `orphaned="true"`. On save, the updated review state is written back out.
