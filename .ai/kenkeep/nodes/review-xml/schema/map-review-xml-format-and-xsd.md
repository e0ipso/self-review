---
type: map
title: review.xml format and XSD
description: >-
  v3 XML review documents contain files, comments, suggestions, attachments, and
  ordered flat reply threads.
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
A `review.xml` document has a `<review>` root with source metadata and direct `<file>` children. Files carry path, change type, and viewed state. Comments contain a body, category, optional line range, optional suggestion and attachments, followed by an optional ordered list of `<reply>` elements.

A reply carries a body, optional author, and optional attachments. Replies are flat and document order is conversation order. The canonical schema is `.agents/skills/self-review-apply/assets/self-review-v3.xsd`, with namespace `urn:self-review:v3`.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
