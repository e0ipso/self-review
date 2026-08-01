---
type: practice
title: Emit no wrapper elements in the XML output
description: >-
  file elements are direct children of review; no files or comments wrapper, no
  summary element.
tags:
  - xml
  - schema
kk_schema_version: 3
kk_id: practice-emit-no-wrapper-elements-in-the-xml-output
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The XML schema is intentionally flat. `<file>` elements are direct children of `<review>`. Do not emit `<files>`, `<comments>`, or `<summary>` wrappers.

A `<comment>` with no line attributes is a file-level comment; a `<comment>` with line attributes is a line or multi-line comment. There is no separate element for file-level comments.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
