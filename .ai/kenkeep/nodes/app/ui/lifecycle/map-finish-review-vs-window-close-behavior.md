---
type: map
title: Finish Review vs window-close behavior
description: >-
  Finish Review saves and exits; closing via X/Cmd+Q shows a three-way Save &
  Quit / Discard / Cancel dialog.
tags:
  - task-manager
  - close-behavior
  - save
kk_schema_version: 3
kk_id: map-finish-review-vs-window-close-behavior
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Clicking 'Finish Review' saves the review to the output file and exits. Closing the window via X, Cmd+Q, or Alt+F4 shows a three-way confirmation dialog: Save & Quit / Discard / Cancel. This protects against accidental loss of in-progress review state.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
