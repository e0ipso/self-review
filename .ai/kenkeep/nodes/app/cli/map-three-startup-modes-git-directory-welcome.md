---
type: map
title: 'Three startup modes: git, directory, welcome'
description: >-
  git mode reviews a git diff; directory mode treats all files as new additions;
  welcome mode shows a picker when launched without context.
tags:
  - mode
  - git
  - directory
  - welcome
kk_schema_version: 3
kk_id: map-three-startup-modes-git-directory-welcome
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
On startup the app picks one of three modes:

- **Git mode**: cwd is inside a git repo. Runs `git diff` with the user's args; shows tracked and (optionally) untracked changes.
- **Directory mode**: cwd is not a git repo but the first positional arg is an existing directory. Recursively scans the directory and treats every file as a new addition (`changeType: 'added'`). XML output uses `source-path` instead of `git-diff-args`/`repository`.
- **Welcome mode**: launched outside a git repo with no directory arg (e.g., from Finder). Shows a welcome screen with a directory picker.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
