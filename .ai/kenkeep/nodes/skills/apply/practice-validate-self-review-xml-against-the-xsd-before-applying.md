---
type: practice
title: Validate self-review XML against the XSD before applying
description: >-
  Run xmllint against assets/self-review-v3.xsd before processing review
  feedback; stop on failure.
tags:
  - self-review
  - validation
  - xmllint
kk_schema_version: 3
kk_id: practice-validate-self-review-xml-against-the-xsd-before-applying
kk_derived_from:
  - .opencode/skills/self-review-apply/SKILL.md
  - .agents/skills/self-review-apply/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Before consuming a `review.xml` file, validate it with `xmllint --schema assets/self-review-v3.xsd <review-xml-path> --noout`. If validation fails, stop and report the errors instead of attempting to apply broken feedback.

If `xmllint` is not installed in the environment, warn the user and continue without validation rather than blocking the workflow.

<!-- kk:citations:start -->
# Citations

[1] [.opencode/skills/self-review-apply/SKILL.md](.opencode/skills/self-review-apply/SKILL.md)
[2] [.agents/skills/self-review-apply/SKILL.md](.agents/skills/self-review-apply/SKILL.md)
<!-- kk:citations:end -->
