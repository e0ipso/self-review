---
type: map
title: self-review-v2 XSD output format
description: >-
  Versioned XSD schema for review output; namespace urn:self-review:v2; file is
  bundled with the app.
tags:
  - xml
  - schema
  - output
kk_schema_version: 3
kk_id: map-self-review-v1-xsd-output-format
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The review output is XML conforming to a published, versioned XSD schema (`self-review-v2.xsd`, namespace `urn:self-review:v2`). The schema is bundled with the application and is intentionally fed to AI agents alongside the review XML so the agent can understand structure, semantics, and constraints.

Versioning (`v2` at time of writing) allows future schema evolution without breaking existing consumers. The root `<review>` element has mode-dependent attributes: `git-diff-args` and `repository` in git mode, `source-path` in directory mode.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
