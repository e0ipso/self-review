---
schema_version: 1
id: practice-prefill-the-suggestion-proposed-code-editor-with-the-original-code
title: Prefill the suggestion proposed-code editor with the original code
kind: practice
tags:
  - suggestions
  - ux
derived_from:
  - docs/PRD.md
relates_to: []
confidence: high
summary: >-
  When the user activates a suggestion, prefill the proposed-code field with the
  original so they can edit in place.
---
When the user activates a suggestion block within a comment, prefill the proposed-code editor with the original code. This matches GitHub and GitLab behavior and lets the reviewer edit in place rather than retyping.

The XML output preserves both the original lines (from the diff) and the proposed replacement as literal text, so the consuming AI agent can apply the suggestion via text replacement.
