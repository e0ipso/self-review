---
type: map
title: review.xml format and XSD
description: >-
  XML document with <review> root containing <file> entries; comments carry line
  ranges, categories, and optional suggestion blocks.
tags:
  - self-review
  - schema
  - xml
kk_schema_version: 3
kk_id: map-review-xml-format-and-xsd
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The `review.xml` document has a `<review>` root with attributes `timestamp`, `git-diff-args`, and `repository` (absolute repo path). It contains `<file>` entries with `path`, `change-type` (`added` | `modified` | `deleted` | `renamed`), and `viewed`. Each file may contain `<comment>` elements with body, category, optional line-number pair, and optional `<suggestion>` block (with `<original-code>` and `<proposed-code>`).

Canonical schema: `.agents/skills/self-review-apply/assets/self-review-v2.xsd`. Namespace: `urn:self-review:v2`. The XSD's `<xs:documentation>` annotations describe element and attribute semantics.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
