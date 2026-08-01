---
type: map
title: Rendered image and SVG previews for added files
description: >-
  Raster images load via diff:load-image as base64 data URIs; SVG content from
  addition lines renders via img+data-URI to block scripts.
tags:
  - preview
  - image
  - svg
kk_schema_version: 3
kk_id: map-rendered-image-and-svg-previews-for-added-files
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Added files with raster image extensions (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.ico`, `.bmp`) load via the `diff:load-image` IPC channel as base64 data URIs and display in a constrained `<img>`. Default view is Rendered; files over 10 MB show an error message.

Added `.svg` files extract content from addition lines and render via `<img>` with a `data:image/svg+xml;base64,...` URI, which blocks script execution. Default view for SVG is Raw. Image and SVG rendered previews support file-level comments only (no line-level comments in the rendered view).

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
