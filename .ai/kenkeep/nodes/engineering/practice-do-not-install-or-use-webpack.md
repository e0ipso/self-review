---
type: practice
title: Do not install or use webpack
description: Electron Forge handles bundling; do not add a separate webpack configuration.
tags:
  - task-manager
  - build
  - webpack
kk_schema_version: 3
kk_id: practice-do-not-install-or-use-webpack
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Do not install or use webpack. Electron Forge handles all bundling for the app. Adding webpack would duplicate or conflict with the Forge build pipeline.

**Why:** Electron Forge is the established build/packaging tool; introducing another bundler creates maintenance burden and potential conflicts.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
