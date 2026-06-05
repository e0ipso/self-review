---
schema_version: 1
id: map-rendered-text-view-for-added-markdown-and-html-files
title: Rendered text view for added Markdown and HTML files
kind: map
tags:
  - preview
  - markdown
  - html
  - rendered
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  Newly added .md/.markdown and .html/.htm files get a Raw/Rendered toggle with
  source-line-mapped gutter for line comments.
---
Files with `changeType === 'added'` that are Markdown (`.md`, `.markdown`) or HTML (`.html`, `.htm`) expose a per-file Raw/Rendered toggle in the file header.

- Markdown renders via `react-markdown` with remark-gfm; Mermaid code blocks render as inline SVG diagrams; YAML front matter is shown as a styled key-value table above the prose.
- HTML renders through the same source-line-mapped gutter path used for Markdown.

The rendered view annotates each block with its source line range, so line-range comments map back to new-file line numbers using the same `LineRange` contract as the raw diff view. Modified, deleted, or non-added HTML/Markdown files stay in the raw diff flow.
