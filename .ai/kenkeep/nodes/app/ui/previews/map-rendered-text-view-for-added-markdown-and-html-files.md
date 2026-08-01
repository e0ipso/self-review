---
type: map
title: Rendered text view for added Markdown and HTML files
description: >-
  Newly added .md/.markdown and .html/.htm files get a Raw/Rendered toggle with
  source-line-mapped gutter for line comments.
tags:
  - preview
  - markdown
  - html
  - rendered
kk_schema_version: 3
kk_id: map-rendered-text-view-for-added-markdown-and-html-files
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Files with `changeType === 'added'` that are Markdown (`.md`, `.markdown`) or HTML (`.html`, `.htm`) expose a per-file Raw/Rendered toggle in the file header.

- Markdown renders via `react-markdown` with remark-gfm; Mermaid code blocks render as inline SVG diagrams; YAML front matter is shown as a styled key-value table above the prose.
- HTML renders through the same source-line-mapped gutter path used for Markdown.

The rendered view annotates each block with its source line range, so line-range comments map back to new-file line numbers using the same `LineRange` contract as the raw diff view. Modified, deleted, or non-added HTML/Markdown files stay in the raw diff flow.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
