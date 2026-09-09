---
type: practice
title: 'Pair comment line numbers as either new or old'
description: >-
  Line comments use one complete side-specific pair; file comments use neither.
tags:
  - self-review
  - xml
  - line-numbers
kk_schema_version: 3
kk_id: practice-pair-comment-line-numbers-as-either-new-or-old-never-both
kk_derived_from:
  - .agents/skills/self-review-apply/assets/self-review-v3.xsd
  - AGENTS.md
kk_relates_to:
  - map-review-xml-format-and-xsd
kk_depends_on: []
kk_confidence: high
---
Use new-line-start/new-line-end for added or context lines and old-line-start/old-line-end for deleted lines. A line comment has exactly one complete pair; a file comment has neither. This is an application/authoring invariant: the XSD 1.0 attributes alone do not enforce the mutual exclusion.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-apply/assets/self-review-v3.xsd](../../../../../.agents/skills/self-review-apply/assets/self-review-v3.xsd)
[2] [AGENTS.md](../../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-review-xml-format-and-xsd](../schema/map-review-xml-format-and-xsd.md)
<!-- kk:related:end -->
