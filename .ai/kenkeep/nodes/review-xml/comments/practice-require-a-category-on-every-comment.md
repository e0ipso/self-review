---
type: practice
title: Require a category on every comment
description: >-
  Every comment must have exactly one category, selected via radio-button
  semantics with the first configured category as default.
tags:
  - xml
  - categories
kk_schema_version: 3
kk_id: practice-require-a-category-on-every-comment
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Every comment must be assigned a category (e.g., `bug`, `style`, `question`, `nit`, `security`). Categories are defined in the project-level configuration and are included in the XML output to help AI agents prioritize and categorize feedback.

The category selector uses radio-button semantics: exactly one category is always selected and cannot be deselected. The first configured category is selected by default when creating a new comment.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
