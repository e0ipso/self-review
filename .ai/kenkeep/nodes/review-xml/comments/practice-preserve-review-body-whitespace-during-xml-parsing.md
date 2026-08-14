---
type: practice
title: Preserve review body whitespace during XML parsing
description: >-
  Disable XML value trimming so comment and reply Markdown bodies round-trip
  byte-identically.
tags:
  - self-review
  - xml
  - parsing
  - markdown
kk_schema_version: 3
kk_id: practice-preserve-review-body-whitespace-during-xml-parsing
kk_derived_from:
  - '77699372-867d-4d60-9007-5aa0b672863d:practice:1'
kk_relates_to:
  - map-review-xml-format-and-xsd
kk_depends_on: []
kk_confidence: high
---
Configure review XML parsing with `trimValues: false`. Comment and reply bodies may contain Markdown indentation, fenced code, or intentional leading and trailing spaces; trimming changes the conversation and violates the byte-identical round-trip contract.

<!-- kk:related:start -->
# Related

- Related: [map-review-xml-format-and-xsd](/review-xml/map-review-xml-format-and-xsd.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [77699372-867d-4d60-9007-5aa0b672863d:practice:1](77699372-867d-4d60-9007-5aa0b672863d:practice:1)
<!-- kk:citations:end -->
