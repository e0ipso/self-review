---
type: practice
title: Validate generated review.xml against the XSD with xmllint
description: >-
  Run `xmllint --schema ... --noout` against the v3 output; fix and re-validate
  failures, or warn and continue when xmllint is unavailable.
tags:
  - self-review
  - critique
  - validation
kk_schema_version: 3
kk_id: practice-validate-generated-review-xml-against-the-xsd-with-xmllint
kk_derived_from:
  - .opencode/skills/self-review-critique/SKILL.md
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
After writing `review.xml`, validate it against `.agents/skills/self-review-apply/assets/self-review-v3.xsd` using `xmllint`. On validation errors, read the messages, correct the XML, and re-run validation.

If `xmllint` is not installed on the system, warn the user and proceed without validation rather than failing the workflow.

<!-- kk:citations:start -->
# Citations

[1] [.opencode/skills/self-review-critique/SKILL.md](.opencode/skills/self-review-critique/SKILL.md)
[2] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
