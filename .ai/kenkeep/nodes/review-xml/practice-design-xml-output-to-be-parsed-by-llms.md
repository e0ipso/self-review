---
type: practice
title: Design XML output to be parsed by LLMs
description: >-
  Review output is structured XML with an XSD schema so LLMs can reliably parse
  and act on feedback.
tags:
  - output
  - xml
  - ai
kk_schema_version: 3
kk_id: practice-design-xml-output-to-be-parsed-by-llms
kk_derived_from:
  - README.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The README states: "AI-native output. The XML format is designed to be parsed by LLMs, with an XSD schema they can reference for structure."

**Why:** The intended consumer of review.xml is an AI coding assistant that applies the feedback. Structure must be machine-parseable.

**How to apply:** When modifying the output format, preserve XSD-validatable structure and keep the schema as the contract for downstream consumers like the self-review-apply skill.

<!-- kk:citations:start -->
# Citations

[1] [README.md](README.md)
<!-- kk:citations:end -->
