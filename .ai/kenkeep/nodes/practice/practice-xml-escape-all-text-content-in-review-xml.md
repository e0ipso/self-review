---
schema_version: 1
id: practice-xml-escape-all-text-content-in-review-xml
title: XML-escape all text content in review.xml
kind: practice
tags:
  - self-review
  - xml
  - escaping
derived_from:
  - .agents/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  Escape &, <, >, ", and ' in body, code, and category text when constructing
  the XML by hand.
---
All text content written into `review.xml` must be XML-escaped: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`, `'` → `&apos;`.

**How to apply:** Apply escaping uniformly to `<body>`, `<original-code>`, `<proposed-code>`, and any other text-bearing elements. Failure to escape will cause XSD validation to fail and may corrupt code suggestions.
