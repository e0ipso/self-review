---
schema_version: 1
id: map-three-startup-modes-git-directory-welcome
title: 'Three startup modes: git, directory, welcome'
kind: map
tags:
  - mode
  - git
  - directory
  - welcome
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  git mode reviews a git diff; directory mode treats all files as new additions;
  welcome mode shows a picker when launched without context.
---
On startup the app picks one of three modes:

- **Git mode**: cwd is inside a git repo. Runs `git diff` with the user's args; shows tracked and (optionally) untracked changes.
- **Directory mode**: cwd is not a git repo but the first positional arg is an existing directory. Recursively scans the directory and treats every file as a new addition (`changeType: 'added'`). XML output uses `source-path` instead of `git-diff-args`/`repository`.
- **Welcome mode**: launched outside a git repo with no directory arg (e.g., from Finder). Shows a welcome screen with a directory picker.
