---
schema_version: 1
id: practice-differentiate-finish-review-from-window-close
title: Differentiate Finish Review from window close
kind: practice
tags:
  - exit
  - save
  - ux
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  Finish Review saves and exits immediately. Closing the window via OS shows a
  three-way Save & Quit / Discard / Cancel dialog.
---
Clicking the "Finish Review" button in the toolbar saves the review to the configured output file and exits immediately with code 0. This is the primary exit path.

Closing the window by any OS-level method (X, Cmd+Q, Alt+F4) shows a three-way confirmation dialog: Save & Quit, Discard, or Cancel. The dialog is skipped automatically if no comments have been added. Both save paths write an XML file (an empty review with zero comments is still valid against the schema).
