---
type: map
title: self-review XML schema (self-review-v2.xsd)
description: >-
  XSD schema at assets/self-review-v2.xsd defining the self-review XML format
  consumed by the apply skill.
tags:
  - self-review
  - xsd
  - schema
kk_schema_version: 3
kk_id: map-self-review-xml-schema-self-review-v1-xsd
kk_derived_from:
  - .opencode/skills/self-review-apply/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The self-review XML format is defined by `assets/self-review-v2.xsd`, located alongside the `self-review-apply` skill. It is the contract for `<review>` documents, including the `git-diff-args`/`repository` (git mode) and `source-path` (directory mode) root attributes, the `change-type` enumeration (`added`, `modified`, `deleted`, `renamed`), the `viewed` per-file flag, and the line-number pairing rules for comments.

For renamed files, the `path` attribute holds the new path, not the original.

<!-- kk:citations:start -->
# Citations

[1] [.opencode/skills/self-review-apply/SKILL.md](.opencode/skills/self-review-apply/SKILL.md)
<!-- kk:citations:end -->
