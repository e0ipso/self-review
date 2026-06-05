---
schema_version: 1
id: practice-emit-no-wrapper-elements-in-the-xml-output
title: Emit no wrapper elements in the XML output
kind: practice
tags:
  - xml
  - schema
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  file elements are direct children of review; no files or comments wrapper, no
  summary element.
---
The XML schema is intentionally flat. `<file>` elements are direct children of `<review>`. Do not emit `<files>`, `<comments>`, or `<summary>` wrappers.

A `<comment>` with no line attributes is a file-level comment; a `<comment>` with line attributes is a line or multi-line comment. There is no separate element for file-level comments.
