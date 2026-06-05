---
schema_version: 1
id: map-review-xml-format-and-xsd
title: review.xml format and XSD
kind: map
tags:
  - self-review
  - schema
  - xml
derived_from:
  - .agents/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  XML document with <review> root containing <file> entries; comments carry line
  ranges, categories, and optional suggestion blocks.
---
The `review.xml` document has a `<review>` root with attributes `timestamp`, `git-diff-args`, and `repository` (absolute repo path). It contains `<file>` entries with `path`, `change-type` (`added` | `modified` | `deleted` | `renamed`), and `viewed`. Each file may contain `<comment>` elements with body, category, optional line-number pair, and optional `<suggestion>` block (with `<original-code>` and `<proposed-code>`).

Canonical schema: `.agents/skills/self-review-apply/assets/self-review-v1.xsd`. Namespace: `urn:self-review:v1`. The XSD's `<xs:documentation>` annotations describe element and attribute semantics.
