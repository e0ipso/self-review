---
type: map
title: self-review-v3 XSD output format
description: >-
  Review output uses self-review-v3.xsd and urn:self-review:v3; v1 and v2
  schemas remain frozen for older consumers.
tags:
  - xml
  - schema
  - output
kk_schema_version: 3
kk_id: map-self-review-v1-xsd-output-format
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Review output conforms to `self-review-v3.xsd` in namespace `urn:self-review:v3`. The schema is bundled with the application and supplied to AI consumers so they can understand the document's structure, semantics, and constraints.

The application reads v1, v2, and v3 documents but always writes v3. The older v1 and v2 schemas remain frozen so consumers holding older documents retain compatible validators.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
