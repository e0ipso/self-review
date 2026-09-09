---
type: practice
title: Keep review comment mutations immutable
description: >-
  Replace affected comment objects so useReviewBridge emits onReviewChange;
  preserve them for viewed-only file updates.
tags:
  - react
  - review-state
  - callbacks
  - immutability
kk_schema_version: 3
kk_id: practice-keep-review-comment-mutations-immutable
kk_derived_from:
  - .ai/kenkeep/_sessions/20260731-2121-77699372-867d-4d60-9007-5aa0b672863d.md
kk_relates_to:
  - map-reviewpanel-and-singlefilereview-entry-components
  - map-self-review-react-package
kk_depends_on: []
kk_confidence: high
---
Every comment or reply mutation must replace the affected `ReviewComment` object immutably. `useReviewBridge` detects reactive review changes by comparing flattened comment object references, so nested reply add, edit, and delete operations must produce a new root comment object.

Viewed-only file updates preserve the existing comment references so they do not emit a spurious `onReviewChange` callback.

<!-- kk:citations:start -->
# Citations

[1] [.ai/kenkeep/_sessions/20260731-2121-77699372-867d-4d60-9007-5aa0b672863d.md](../../../_sessions/20260731-2121-77699372-867d-4d60-9007-5aa0b672863d.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-reviewpanel-and-singlefilereview-entry-components](map-reviewpanel-and-singlefilereview-entry-components.md)
- Related: [map-self-review-react-package](map-self-review-react-package.md)
<!-- kk:related:end -->
