---
schema_version: 1
id: practice-do-not-install-or-use-webpack
title: Do not install or use webpack
kind: practice
tags:
  - task-manager
  - build
  - webpack
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: Electron Forge handles bundling; do not add a separate webpack configuration.
---
Do not install or use webpack. Electron Forge handles all bundling for the app. Adding webpack would duplicate or conflict with the Forge build pipeline.

**Why:** Electron Forge is the established build/packaging tool; introducing another bundler creates maintenance burden and potential conflicts.
