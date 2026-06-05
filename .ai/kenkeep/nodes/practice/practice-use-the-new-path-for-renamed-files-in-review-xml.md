---
schema_version: 1
id: practice-use-the-new-path-for-renamed-files-in-review-xml
title: Use the new path for renamed files in review XML
kind: practice
tags:
  - self-review
  - xml
  - renames
derived_from:
  - .agents/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  For change-type="renamed" entries, the path attribute carries the new path,
  not the original path.
---
When a file is renamed (`change-type="renamed"`), the `path` attribute on `<file>` must be the new path. Read the file at its new path when gathering context for the critique.
