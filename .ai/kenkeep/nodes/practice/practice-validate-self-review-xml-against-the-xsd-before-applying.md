---
schema_version: 1
id: practice-validate-self-review-xml-against-the-xsd-before-applying
title: Validate self-review XML against the XSD before applying
kind: practice
tags:
  - self-review
  - validation
  - xmllint
derived_from:
  - .opencode/skills/self-review-apply/SKILL.md
relates_to: []
confidence: high
summary: >-
  Run xmllint against assets/self-review-v1.xsd before processing review
  feedback; stop on failure.
---
Before consuming a `review.xml` file, validate it with `xmllint --schema assets/self-review-v1.xsd <review-xml-path> --noout`. If validation fails, stop and report the errors instead of attempting to apply broken feedback.

If `xmllint` is not installed in the environment, warn the user and continue without validation rather than blocking the workflow.
