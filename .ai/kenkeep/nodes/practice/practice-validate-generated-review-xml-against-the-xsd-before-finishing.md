---
schema_version: 1
id: practice-validate-generated-review-xml-against-the-xsd-before-finishing
title: Validate generated review.xml against the XSD before finishing
kind: practice
tags:
  - self-review
  - xml
  - validation
derived_from:
  - .agents/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  Run xmllint against .agents/skills/self-review-apply/assets/self-review-v1.xsd
  after writing the file; fix and re-validate on failure.
---
After writing `review.xml`, validate it with:

```bash
xmllint --schema .agents/skills/self-review-apply/assets/self-review-v1.xsd <path> --noout
```

If validation fails, read the xmllint errors, fix the XML, and re-validate. If `xmllint` is not installed on the system, warn the user and continue without validation rather than failing the workflow.
