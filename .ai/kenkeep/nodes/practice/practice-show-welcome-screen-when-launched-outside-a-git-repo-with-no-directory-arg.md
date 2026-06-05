---
schema_version: 1
id: >-
  practice-show-welcome-screen-when-launched-outside-a-git-repo-with-no-directory-arg
title: Show welcome screen when launched outside a git repo with no directory arg
kind: practice
tags:
  - startup
  - launcher
  - welcome
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  Don't error-exit when launched from Finder or an app launcher; show the
  welcome screen with a directory picker instead.
---
When the working directory is not a git repository and no positional directory argument is provided, the app must display the welcome screen rather than printing an error and exiting. This is the launcher-friendly path (macOS Finder, Linux desktop entries).

Mode determination order on startup: (1) if cwd is inside a git repo → git mode; (2) else if first positional arg is an existing directory → directory mode; (3) else → welcome mode. macOS Finder passes `-psn_XXXX` as an argument; the CLI parser must filter these out before processing.
