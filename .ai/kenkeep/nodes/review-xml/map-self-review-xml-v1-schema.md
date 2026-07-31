---
type: map
title: self-review XML v2 schema
description: >-
  XSD schema at .agents/skills/self-review-apply/assets/self-review-v2.xsd
  defining the review.xml format.
tags:
  - self-review
  - xml
  - schema
kk_schema_version: 3
kk_id: map-self-review-xml-v1-schema
kk_derived_from:
  - .opencode/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The canonical XSD for the self-review v2 XML format lives at `.agents/skills/self-review-apply/assets/self-review-v2.xsd`. It defines the structure of `<review>`, `<file>`, `<comment>`, and `<suggestion>` elements, and the allowed values for attributes such as `change-type` (`added`, `modified`, `deleted`, `renamed`).

The XSD's `<xs:documentation>` annotations are the authoritative reference for element and attribute semantics. Both the critique and apply skills depend on this schema.

<!-- kk:citations:start -->
# Citations

[1] [.opencode/skills/self-review-critique/SKILL.md](.opencode/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
