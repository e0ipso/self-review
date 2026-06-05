---
schema_version: 1
id: practice-use-shadcn-ui-components-instead-of-raw-html-for-ui
title: Use shadcn/ui components instead of raw HTML for UI
kind: practice
tags:
  - task-manager
  - ui
  - shadcn
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  All buttons, inputs, dropdowns, dialogs, etc. must use shadcn/ui; no raw HTML
  equivalents.
---
Do not use raw HTML elements for buttons, inputs, dropdowns, dialogs, or similar controls. Use shadcn/ui components (built on Radix primitives) for all UI. Comment bodies use `@uiw/react-md-editor` in write-only mode; suggestion code textareas remain plain shadcn `<Textarea>`.

**Why:** Consistent theming, accessibility, and behavior across the app; shadcn is already the established component layer.
