---
schema_version: 1
id: practice-validate-generated-review-xml-against-the-xsd-with-xmllint
title: Validate generated review.xml against the XSD with xmllint
kind: practice
tags:
  - self-review
  - critique
  - validation
derived_from:
  - .opencode/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  Run `xmllint --schema ... --noout` against the output. If validation fails,
  fix the XML and re-validate. If xmllint is missing, warn and continue.
---
After writing `review.xml`, validate it against `.claude/skills/self-review-apply/assets/self-review-v1.xsd` using `xmllint`. On validation errors, read the messages, correct the XML, and re-run validation.

If `xmllint` is not installed on the system, warn the user and proceed without validation rather than failing the workflow.
