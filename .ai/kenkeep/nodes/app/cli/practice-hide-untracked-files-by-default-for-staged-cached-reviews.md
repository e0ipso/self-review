---
type: practice
title: Hide untracked files by default for --staged/--cached reviews
description: >-
  Index-vs-HEAD reviews hide untracked files by default since they aren't part
  of the index; users can reveal them via toolbar toggle.
tags:
  - staged
  - untracked
  - defaults
kk_schema_version: 3
kk_id: practice-hide-untracked-files-by-default-for-staged-cached-reviews
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
In addition to tracked changes, the app discovers untracked files via `git ls-files --others --exclude-standard` and renders synthetic diffs showing all lines as additions.

For `--staged` / `--cached` reviews (index-vs-HEAD), untracked files are hidden by default because they are not part of the index. They remain preloaded and can be revealed instantly via the "Show New Files" toolbar toggle. Setting `show-untracked: true` explicitly in YAML overrides this default.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
