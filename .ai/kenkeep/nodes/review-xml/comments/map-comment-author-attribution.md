---
type: map
title: Comment author attribution
description: >-
  Critique-generated comments include an author attribute (model name); absent
  author shows 'You' with a person icon.
tags:
  - strikethroo
  - comments
  - author
kk_schema_version: 3
kk_id: map-comment-author-attribution
kk_derived_from:
  - AGENTS.md
kk_relates_to:
  - map-review-xml-format-and-xsd
kk_depends_on: []
kk_confidence: high
---
Comments from the `self-review-critique` skill include an `author` attribute with the model name. When the attribute is absent, the UI shows 'You' with a person icon to indicate a human reviewer. This distinguishes AI-generated critique from human comments in the same review file.

<!-- kk:citations:start -->
# Citations

[1] [AGENTS.md](../../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-review-xml-format-and-xsd](../schema/map-review-xml-format-and-xsd.md)
<!-- kk:related:end -->
