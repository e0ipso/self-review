---
type: map
title: self-review application
description: >-
  Local-only Electron desktop app providing a GitHub-style PR review UI for
  local git diffs and directory reviews.
tags:
  - overview
  - app
kk_schema_version: 3
kk_id: map-self-review-application
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
self-review is a local-only Electron desktop application that provides a GitHub-style pull request review interface for reviewing code diffs without pushing to a remote repository. It is designed for solo developers reviewing AI-generated code.

The app is CLI-first, one-shot (open → review → close → done), with no persistent state or background servers. Output is XML written to a file (default `./review.xml`) and is intended primarily for AI agent consumption rather than human reading.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
