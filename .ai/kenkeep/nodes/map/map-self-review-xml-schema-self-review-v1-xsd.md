---
schema_version: 1
id: map-self-review-xml-schema-self-review-v1-xsd
title: self-review XML schema (self-review-v1.xsd)
kind: map
tags:
  - self-review
  - xsd
  - schema
derived_from:
  - .opencode/skills/self-review-apply/SKILL.md
relates_to: []
confidence: high
summary: >-
  XSD schema at assets/self-review-v1.xsd defining the self-review XML format
  consumed by the apply skill.
---
The self-review XML format is defined by `assets/self-review-v1.xsd`, located alongside the `self-review-apply` skill. It is the contract for `<review>` documents, including the `git-diff-args`/`repository` (git mode) and `source-path` (directory mode) root attributes, the `change-type` enumeration (`added`, `modified`, `deleted`, `renamed`), the `viewed` per-file flag, and the line-number pairing rules for comments.

For renamed files, the `path` attribute holds the new path, not the original.
