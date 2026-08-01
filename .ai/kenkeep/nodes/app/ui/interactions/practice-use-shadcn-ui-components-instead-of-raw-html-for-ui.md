---
type: practice
title: Use shadcn/ui components instead of raw HTML for UI
description: >-
  All buttons, inputs, dropdowns, dialogs, etc. must use shadcn/ui; no raw HTML
  equivalents.
tags:
  - task-manager
  - ui
  - shadcn
kk_schema_version: 3
kk_id: practice-use-shadcn-ui-components-instead-of-raw-html-for-ui
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Do not use raw HTML elements for buttons, inputs, dropdowns, dialogs, or similar controls. Use shadcn/ui components (built on Radix primitives) for all UI. Comment bodies use `@uiw/react-md-editor` in write-only mode; suggestion code textareas remain plain shadcn `<Textarea>`.

**Why:** Consistent theming, accessibility, and behavior across the app; shadcn is already the established component layer.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
