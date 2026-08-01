---
type: practice
title: Convert v2 gate reviews to v3 before applying
description: >-
  st-code-review emits v2 XML while self-review-apply validates v3; retarget and
  validate the document before applying it.
tags:
  - self-review
  - xml
  - compatibility
  - workflow
kk_schema_version: 3
kk_id: practice-convert-v2-gate-reviews-to-v3-before-applying
kk_derived_from:
  - '77699372-867d-4d60-9007-5aa0b672863d:practice:0'
kk_relates_to:
  - map-self-review-apply-skill
  - map-review-xml-format-and-xsd
kk_depends_on: []
kk_confidence: high
---
When a `review.xml` produced by `st-code-review` is handed to `/self-review-apply`, convert the root namespace from `urn:self-review:v2` to `urn:self-review:v3` and validate the converted document against `assets/self-review-v3.xsd` before applying feedback.

The Strikethroo review gate emits v2 documents, while the apply skill requires v3 validation. Passing the gate artifact through unchanged causes schema validation to fail at the root element.

<!-- kk:related:start -->
# Related

- Related: [map-self-review-apply-skill](/skills/apply/map-self-review-apply-skill.md)
- Related: [map-review-xml-format-and-xsd](/review-xml/map-review-xml-format-and-xsd.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [77699372-867d-4d60-9007-5aa0b672863d:practice:0](77699372-867d-4d60-9007-5aa0b672863d:practice:0)
<!-- kk:citations:end -->
