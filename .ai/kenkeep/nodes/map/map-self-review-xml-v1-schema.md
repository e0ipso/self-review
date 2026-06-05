---
schema_version: 1
id: map-self-review-xml-v1-schema
title: self-review XML v1 schema
kind: map
tags:
  - self-review
  - xml
  - schema
derived_from:
  - .opencode/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  XSD schema at .claude/skills/self-review-apply/assets/self-review-v1.xsd
  defining the review.xml format.
---
The canonical XSD for the self-review v1 XML format lives at `.claude/skills/self-review-apply/assets/self-review-v1.xsd`. It defines the structure of `<review>`, `<file>`, `<comment>`, and `<suggestion>` elements, and the allowed values for attributes such as `change-type` (`added`, `modified`, `deleted`, `renamed`).

The XSD's `<xs:documentation>` annotations are the authoritative reference for element and attribute semantics. Both the critique and apply skills depend on this schema.
