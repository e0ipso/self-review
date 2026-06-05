---
schema_version: 1
id: map-rendered-file-previews
title: Rendered file previews
kind: map
tags:
  - task-manager
  - rendered-preview
  - file-types
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  Markdown, HTML, raster images, and SVG support Raw/Rendered toggles for newly
  added files.
---
Newly added files (`changeType === 'added'`) of certain types support a Raw/Rendered toggle in the file header:

- **Markdown** (`.md`, `.markdown`) — rendered via `react-markdown` with line-mapped comment gutter; YAML front matter is shown as a styled key-value table above the prose.
- **HTML** (`.html`, `.htm`) — rendered through the shared rendered-text path used by Markdown, with source-line-mapped gutter; modified/deleted HTML files are not rendered.
- **Raster images** (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.ico`, `.bmp`) — loaded as base64 data URIs via `diff:load-image` and displayed in a constrained `<img>`; defaults to Rendered view; files over 10 MB show an error.
- **SVG** (`.svg`) — content extracted from addition lines and rendered via `<img>` with `data:image/svg+xml;base64,...` URI (blocks script execution); defaults to Raw view.

File-level comments are available on all preview types. Line-level comments work in Raw view and via the source-line-mapped gutter for Markdown/HTML rendered views.
