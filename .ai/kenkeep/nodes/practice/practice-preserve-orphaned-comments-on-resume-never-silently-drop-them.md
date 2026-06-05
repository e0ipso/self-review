---
schema_version: 1
id: practice-preserve-orphaned-comments-on-resume-never-silently-drop-them
title: Preserve orphaned comments on resume; never silently drop them
kind: practice
tags:
  - resume
  - comments
  - data-integrity
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  Comments from a resumed review that can't be mapped to current lines get
  orphaned="true" and a visual indicator, never deleted.
---
With `--resume-from`, line numbers from a prior review may no longer match the current diff. The app attempts best-effort matching using surrounding context (similar to git rename detection).

Comments that cannot be mapped to any current line are preserved in the output with an `orphaned="true"` attribute and displayed at the top of the relevant file section with a visual indicator. Prior comments are never silently dropped.
