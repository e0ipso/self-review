---
schema_version: 1
id: map-self-review-application
title: self-review application
kind: map
tags:
  - overview
  - app
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  Local-only Electron desktop app providing a GitHub-style PR review UI for
  local git diffs and directory reviews.
---
self-review is a local-only Electron desktop application that provides a GitHub-style pull request review interface for reviewing code diffs without pushing to a remote repository. It is designed for solo developers reviewing AI-generated code.

The app is CLI-first, one-shot (open → review → close → done), with no persistent state or background servers. Output is XML written to a file (default `./review.xml`) and is intended primarily for AI agent consumption rather than human reading.
