---
schema_version: 1
id: practice-design-xml-output-to-be-parsed-by-llms
title: Design XML output to be parsed by LLMs
kind: practice
tags:
  - output
  - xml
  - ai
derived_from:
  - README.md
relates_to: []
confidence: high
summary: >-
  Review output is structured XML with an XSD schema so LLMs can reliably parse
  and act on feedback.
---
The README states: "AI-native output. The XML format is designed to be parsed by LLMs, with an XSD schema they can reference for structure."

**Why:** The intended consumer of review.xml is an AI coding assistant that applies the feedback. Structure must be machine-parseable.

**How to apply:** When modifying the output format, preserve XSD-validatable structure and keep the schema as the contract for downstream consumers like the self-review-apply skill.
