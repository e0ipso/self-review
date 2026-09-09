---
type: map
title: review.xml format and XSD
description: >-
  v3 XML review documents contain files, comments, suggestions, attachments, and
  ordered flat reply threads.
tags:
  - self-review
  - schema
  - xml
kk_schema_version: 3
kk_id: map-review-xml-format-and-xsd
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to:
  - map-comment-author-attribution
  - practice-preserve-review-body-whitespace-during-xml-parsing
  - practice-require-a-category-on-every-comment
  - practice-use-the-new-path-for-renamed-files-in-review-xml
  - practice-xml-escape-all-text-content-in-review-xml
  - practice-line-comments-reference-either-old-or-new-line-numbers-never-both
  - practice-pair-comment-line-numbers-as-either-new-or-old-never-both
  - practice-pair-line-number-attributes-correctly-in-review-comments
  - practice-pair-line-number-attributes-correctly-on-review-comments
  - practice-use-old-vs-new-line-numbers-based-on-the-commented-line-type
  - map-self-review-v1-xsd-output-format
  - map-self-review-xml-schema-self-review-v1-xsd
  - map-self-review-xml-v1-schema
  - map-xsd-schema-location
  - practice-design-xml-output-to-be-parsed-by-llms
  - practice-emit-no-wrapper-elements-in-the-xml-output
  - practice-keep-the-xsd-schema-in-sync-across-its-two-locations
  - practice-validate-xml-output-against-the-xsd-before-writing
kk_depends_on: []
kk_confidence: high
---
A `review.xml` document has a `<review>` root with source metadata and direct `<file>` children. The root supports three mutually exclusive source shapes: git mode (`git-diff-args`/`repository`), directory mode (`source-path`), and remote mode (optional `remote-url`, `remote-base-sha`, `remote-head-sha`, `remote-forge` for reviews of a remote PR/MR). Files carry path, change type, and viewed state. Comments contain a body, category, optional line range, optional suggestion and attachments, followed by an optional ordered list of `<reply>` elements. Comments and replies may carry a `remote-id` (forge thread/comment id) — provenance preserved on round-trip, consumed by nothing today.

A reply carries a body, optional author, and optional attachments. Replies are flat and document order is conversation order. The canonical schema is `.agents/skills/self-review-apply/assets/self-review-v3.xsd`, with namespace `urn:self-review:v3`.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](../../../../../.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-comment-author-attribution](../comments/map-comment-author-attribution.md)
- Related: [practice-preserve-review-body-whitespace-during-xml-parsing](../comments/practice-preserve-review-body-whitespace-during-xml-parsing.md)
- Related: [practice-require-a-category-on-every-comment](../comments/practice-require-a-category-on-every-comment.md)
- Related: [practice-use-the-new-path-for-renamed-files-in-review-xml](../comments/practice-use-the-new-path-for-renamed-files-in-review-xml.md)
- Related: [practice-xml-escape-all-text-content-in-review-xml](../comments/practice-xml-escape-all-text-content-in-review-xml.md)
- Related: [practice-line-comments-reference-either-old-or-new-line-numbers-never-both](../line-anchors/practice-line-comments-reference-either-old-or-new-line-numbers-never-both.md)
- Related: [practice-pair-comment-line-numbers-as-either-new-or-old-never-both](../line-anchors/practice-pair-comment-line-numbers-as-either-new-or-old-never-both.md)
- Related: [practice-pair-line-number-attributes-correctly-in-review-comments](../line-anchors/practice-pair-line-number-attributes-correctly-in-review-comments.md)
- Related: [practice-pair-line-number-attributes-correctly-on-review-comments](../line-anchors/practice-pair-line-number-attributes-correctly-on-review-comments.md)
- Related: [practice-use-old-vs-new-line-numbers-based-on-the-commented-line-type](../line-anchors/practice-use-old-vs-new-line-numbers-based-on-the-commented-line-type.md)
- Related: [map-self-review-v1-xsd-output-format](map-self-review-v1-xsd-output-format.md)
- Related: [map-self-review-xml-schema-self-review-v1-xsd](map-self-review-xml-schema-self-review-v1-xsd.md)
- Related: [map-self-review-xml-v1-schema](map-self-review-xml-v1-schema.md)
- Related: [map-xsd-schema-location](map-xsd-schema-location.md)
- Related: [practice-design-xml-output-to-be-parsed-by-llms](practice-design-xml-output-to-be-parsed-by-llms.md)
- Related: [practice-emit-no-wrapper-elements-in-the-xml-output](practice-emit-no-wrapper-elements-in-the-xml-output.md)
- Related: [practice-keep-the-xsd-schema-in-sync-across-its-two-locations](practice-keep-the-xsd-schema-in-sync-across-its-two-locations.md)
- Related: [practice-validate-xml-output-against-the-xsd-before-writing](practice-validate-xml-output-against-the-xsd-before-writing.md)
<!-- kk:related:end -->
