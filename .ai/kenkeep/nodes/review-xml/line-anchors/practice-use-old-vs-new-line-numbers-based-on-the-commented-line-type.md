---
type: practice
title: Use old vs new line numbers based on the commented line type
description: >-
  Added/context lines use newLineStart/End; deleted lines use oldLineStart/End;
  exactly one pair, never both.
tags:
  - strikethroo
  - line-numbers
  - comments
kk_schema_version: 3
kk_id: practice-use-old-vs-new-line-numbers-based-on-the-commented-line-type
kk_derived_from:
  - AGENTS.md
kk_relates_to:
  - map-review-xml-format-and-xsd
kk_depends_on: []
kk_confidence: high
---
Comments on added or context lines use `newLineStart`/`newLineEnd`. Comments on deleted lines use `oldLineStart`/`oldLineEnd`. Exactly one pair is set per comment, never both. File-level comments have neither.

**Why:** Old and new line numbering diverge across hunks; mixing them produces ambiguous or unresolvable references in downstream tooling.

<!-- kk:citations:start -->
# Citations

[1] [AGENTS.md](../../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-review-xml-format-and-xsd](../schema/map-review-xml-format-and-xsd.md)
<!-- kk:related:end -->
