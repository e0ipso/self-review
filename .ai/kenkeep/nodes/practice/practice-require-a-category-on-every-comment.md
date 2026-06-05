---
schema_version: 1
id: practice-require-a-category-on-every-comment
title: Require a category on every comment
kind: practice
tags:
  - xml
  - categories
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  Every comment must have exactly one category, selected via radio-button
  semantics with the first configured category as default.
---
Every comment must be assigned a category (e.g., `bug`, `style`, `question`, `nit`, `security`). Categories are defined in the project-level configuration and are included in the XML output to help AI agents prioritize and categorize feedback.

The category selector uses radio-button semantics: exactly one category is always selected and cannot be deselected. The first configured category is selected by default when creating a new comment.
