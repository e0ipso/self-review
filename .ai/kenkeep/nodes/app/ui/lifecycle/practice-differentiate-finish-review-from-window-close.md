---
type: practice
title: Differentiate Finish Review from window close
description: >-
  Finish Review saves and exits immediately. Closing the window via OS shows a
  three-way Save & Quit / Discard / Cancel dialog.
tags:
  - exit
  - save
  - ux
kk_schema_version: 3
kk_id: practice-differentiate-finish-review-from-window-close
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Clicking the "Finish Review" button in the toolbar saves the review to the configured output file and exits immediately with code 0. This is the primary exit path.

Closing the window by any OS-level method (X, Cmd+Q, Alt+F4) shows a three-way confirmation dialog: Save & Quit, Discard, or Cancel. The dialog is skipped automatically if no comments have been added. Both save paths write an XML file (an empty review with zero comments is still valid against the schema).

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
