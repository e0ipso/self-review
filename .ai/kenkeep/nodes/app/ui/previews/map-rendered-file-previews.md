---
type: map
title: Rendered file previews
description: >-
  Markdown, HTML, raster images, and SVG support Raw/Rendered toggles for newly
  added files.
tags:
  - strikethroo
  - rendered-preview
  - file-types
kk_schema_version: 3
kk_id: map-rendered-file-previews
kk_derived_from:
  - AGENTS.md
kk_relates_to:
  - map-rendered-image-and-svg-previews-for-added-files
  - map-rendered-text-view-for-added-markdown-and-html-files
  - practice-force-unified-view-for-added-and-deleted-files
  - practice-use-prism-js-for-syntax-highlighting-with-theme-matching
kk_depends_on: []
kk_confidence: high
---
Newly added files (`changeType === 'added'`) of certain types support a Raw/Rendered toggle in the file header:

- **Markdown** (`.md`, `.markdown`) — rendered via `react-markdown` with line-mapped comment gutter; YAML front matter is shown as a styled key-value table above the prose.
- **HTML** (`.html`, `.htm`) — rendered through the shared rendered-text path used by Markdown, with source-line-mapped gutter; modified/deleted HTML files are not rendered.
- **Raster images** (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.ico`, `.bmp`) — loaded as base64 data URIs via `diff:load-image` and displayed in a constrained `<img>`; defaults to Rendered view; files over 10 MB show an error.
- **SVG** (`.svg`) — content extracted from addition lines and rendered via `<img>` with `data:image/svg+xml;base64,...` URI (blocks script execution); defaults to Raw view.

File-level comments are available on all preview types. Line-level comments work in Raw view and via the source-line-mapped gutter for Markdown/HTML rendered views.

<!-- kk:citations:start -->
# Citations

[1] [AGENTS.md](../../../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-rendered-image-and-svg-previews-for-added-files](map-rendered-image-and-svg-previews-for-added-files.md)
- Related: [map-rendered-text-view-for-added-markdown-and-html-files](map-rendered-text-view-for-added-markdown-and-html-files.md)
- Related: [practice-force-unified-view-for-added-and-deleted-files](practice-force-unified-view-for-added-and-deleted-files.md)
- Related: [practice-use-prism-js-for-syntax-highlighting-with-theme-matching](practice-use-prism-js-for-syntax-highlighting-with-theme-matching.md)
<!-- kk:related:end -->
