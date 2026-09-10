---
type: practice
title: Validate XML output against the XSD before writing
description: >-
  A schema violation exits 1 and writes nothing; a validator that fails to load
  only warns and the file is written unvalidated.
tags:
  - strikethroo
  - xml
  - validation
kk_schema_version: 3
kk_id: practice-validate-xml-output-against-the-xsd-before-writing
kk_derived_from:
  - AGENTS.md
kk_relates_to:
  - map-review-xml-format-and-xsd
kk_depends_on: []
kk_confidence: high
---
The XML serializer validates output against the XSD schema before writing the file, and the two failure modes differ. A schema violation writes the errors to stderr and exits 1, leaving no file behind. A validator that fails to load is deliberately not fatal: `serializeReview` logs `[main] XML validation infrastructure failed: <message> - emitting XML without validation` and returns the document, so `review.xml` is written unvalidated and the process exits 0. A `review.xml` on disk therefore proves validation ran only when that warning is absent from stderr. Both branches are pinned in `packages/core/src/xml-serializer.test.ts`. Do not emit wrapper elements in the XML output (no `<files>`, no `<comments>` wrapper).

**Why:** The XML is consumed by downstream tools (`self-review-apply`); invalid output silently breaks the apply pipeline. The load-failure fallback exists because losing a finished review to a broken xmllint build is the worse outcome. The guide sidecar makes the opposite trade in `packages/core/src/guide-parser.ts`, folding a validator failure into the same `ok: false` as a schema violation, because a dropped guide costs the reviewer nothing.

<!-- kk:citations:start -->
# Citations

[1] [AGENTS.md](../../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-review-xml-format-and-xsd](map-review-xml-format-and-xsd.md)
<!-- kk:related:end -->
