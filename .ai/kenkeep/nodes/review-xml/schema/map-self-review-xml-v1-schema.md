---
type: map
title: self-review XML v3 schema
description: >-
  The canonical v3 XSD defines files, comments, suggestions, attachments, and
  ordered reply threads.
tags:
  - self-review
  - xml
  - schema
kk_schema_version: 3
kk_id: map-self-review-xml-v1-schema
kk_derived_from:
  - .opencode/skills/self-review-critique/SKILL.md
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The canonical XSD for the live self-review XML format is `.agents/skills/self-review-apply/assets/self-review-v3.xsd`. It defines `<review>`, `<file>`, `<comment>`, `<suggestion>`, `<attachment>`, and ordered `<reply>` elements together with their allowed attributes.

The XSD's `<xs:documentation>` annotations are the authoritative reference for element and attribute semantics. The critique and apply skills both use this schema. Frozen v1 and v2 schemas remain alongside it for older documents.

<!-- kk:citations:start -->
# Citations

[1] [.opencode/skills/self-review-critique/SKILL.md](.opencode/skills/self-review-critique/SKILL.md)
[2] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
