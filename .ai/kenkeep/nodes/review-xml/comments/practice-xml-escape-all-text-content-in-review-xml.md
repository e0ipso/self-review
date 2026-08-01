---
type: practice
title: XML-escape all text content in review.xml
description: >-
  Escape &, <, >, ", and ' in body, code, and category text when constructing
  the XML by hand.
tags:
  - self-review
  - xml
  - escaping
kk_schema_version: 3
kk_id: practice-xml-escape-all-text-content-in-review-xml
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
All text content written into `review.xml` must be XML-escaped: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`, `'` → `&apos;`.

**How to apply:** Apply escaping uniformly to `<body>`, `<original-code>`, `<proposed-code>`, and any other text-bearing elements. Failure to escape will cause XSD validation to fail and may corrupt code suggestions.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
