---
schema_version: 1
id: practice-hide-untracked-files-by-default-for-staged-cached-reviews
title: Hide untracked files by default for --staged/--cached reviews
kind: practice
tags:
  - staged
  - untracked
  - defaults
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  Index-vs-HEAD reviews hide untracked files by default since they aren't part
  of the index; users can reveal them via toolbar toggle.
---
In addition to tracked changes, the app discovers untracked files via `git ls-files --others --exclude-standard` and renders synthetic diffs showing all lines as additions.

For `--staged` / `--cached` reviews (index-vs-HEAD), untracked files are hidden by default because they are not part of the index. They remain preloaded and can be revealed instantly via the "Show New Files" toolbar toggle. Setting `show-untracked: true` explicitly in YAML overrides this default.
