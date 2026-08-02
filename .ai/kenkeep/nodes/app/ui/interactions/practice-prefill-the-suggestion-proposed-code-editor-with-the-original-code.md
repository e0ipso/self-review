---
type: practice
title: Prefill the suggestion proposed-code editor with the original code
description: >-
  When the user activates a suggestion, prefill the proposed-code field with the
  original so they can edit in place.
tags:
  - suggestions
  - ux
kk_schema_version: 3
kk_id: practice-prefill-the-suggestion-proposed-code-editor-with-the-original-code
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
When the user activates a suggestion block within a comment, prefill the proposed-code editor with the original code. This matches GitHub and GitLab behavior and lets the reviewer edit in place rather than retyping.

The XML output preserves both the original lines (from the diff) and the proposed replacement as literal text, so the consuming AI agent can apply the suggestion via text replacement.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
