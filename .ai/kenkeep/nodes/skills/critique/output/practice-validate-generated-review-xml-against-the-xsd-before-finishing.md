---
type: practice
title: Validate generated review.xml against the XSD before finishing
description: >-
  Run xmllint against .agents/skills/self-review-apply/assets/self-review-v3.xsd
  after writing the file; fix and re-validate on failure.
tags:
  - self-review
  - xml
  - validation
kk_schema_version: 3
kk_id: practice-validate-generated-review-xml-against-the-xsd-before-finishing
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
After writing `review.xml`, validate it with:

```bash
xmllint --schema .agents/skills/self-review-apply/assets/self-review-v3.xsd <path> --noout
```

If validation fails, read the xmllint errors, fix the XML, and re-validate. If `xmllint` is not installed on the system, warn the user and continue without validation rather than failing the workflow.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
