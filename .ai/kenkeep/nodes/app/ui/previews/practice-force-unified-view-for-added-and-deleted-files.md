---
type: practice
title: Force unified view for added and deleted files
description: >-
  Files with changeType added or deleted always render in unified view
  regardless of the user's selected mode.
tags:
  - ui
  - diff-view
kk_schema_version: 3
kk_id: practice-force-unified-view-for-added-and-deleted-files
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Files with change type `added` or `deleted` always render in unified view, regardless of the selected split/unified setting. In split view these files would waste half the screen: an added file would leave the left pane empty, and a deleted file would leave the right pane empty.

Forcing unified view for these files uses the full width for the content that matters.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
