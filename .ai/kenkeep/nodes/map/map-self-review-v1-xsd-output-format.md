---
schema_version: 1
id: map-self-review-v1-xsd-output-format
title: self-review-v1 XSD output format
kind: map
tags:
  - xml
  - schema
  - output
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  Versioned XSD schema for review output; namespace urn:self-review:v1; file is
  bundled with the app.
---
The review output is XML conforming to a published, versioned XSD schema (`self-review-v1.xsd`, namespace `urn:self-review:v1`). The schema is bundled with the application and is intentionally fed to AI agents alongside the review XML so the agent can understand structure, semantics, and constraints.

Versioning (`v1`) allows future schema evolution without breaking existing consumers. The root `<review>` element has mode-dependent attributes: `git-diff-args` and `repository` in git mode, `source-path` in directory mode.
