---
schema_version: 1
id: practice-prioritize-the-largest-diffs-when-reviewing-many-files
title: Prioritize the largest diffs when reviewing many files
kind: practice
tags:
  - self-review
  - critique
  - performance
derived_from:
  - .agents/skills/self-review-critique/SKILL.md
relates_to: []
confidence: medium
summary: >-
  For diffs with >15 files, read files with the largest diffs first; for very
  large files, read only ±50 lines around changed regions.
---
When the diff covers more than 15 files, prioritize reading files with the largest diffs first to ensure the most impactful changes get full context. For very large individual files, read only the regions around changed lines with roughly 50 lines of surrounding context rather than the entire file.

**Why:** Bounds context consumption while preserving review quality on the changes most likely to contain substantive issues.
