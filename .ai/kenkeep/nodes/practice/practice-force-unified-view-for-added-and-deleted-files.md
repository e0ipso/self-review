---
schema_version: 1
id: practice-force-unified-view-for-added-and-deleted-files
title: Force unified view for added and deleted files
kind: practice
tags:
  - ui
  - diff-view
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  Files with changeType added or deleted always render in unified view
  regardless of the user's selected mode.
---
Files with change type `added` or `deleted` always render in unified view, regardless of the selected split/unified setting. In split view these files would waste half the screen: an added file would leave the left pane empty, and a deleted file would leave the right pane empty.

Forcing unified view for these files uses the full width for the content that matters.
