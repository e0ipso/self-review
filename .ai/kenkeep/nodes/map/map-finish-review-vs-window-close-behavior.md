---
schema_version: 1
id: map-finish-review-vs-window-close-behavior
title: Finish Review vs window-close behavior
kind: map
tags:
  - task-manager
  - close-behavior
  - save
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  Finish Review saves and exits; closing via X/Cmd+Q shows a three-way Save &
  Quit / Discard / Cancel dialog.
---
Clicking 'Finish Review' saves the review to the output file and exits. Closing the window via X, Cmd+Q, or Alt+F4 shows a three-way confirmation dialog: Save & Quit / Discard / Cancel. This protects against accidental loss of in-progress review state.
