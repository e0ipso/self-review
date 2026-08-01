---
type: practice
title: Prioritize the largest diffs when reviewing many files
description: >-
  For diffs with >15 files, read files with the largest diffs first; for very
  large files, read only ±50 lines around changed regions.
tags:
  - self-review
  - critique
  - performance
kk_schema_version: 3
kk_id: practice-prioritize-the-largest-diffs-when-reviewing-many-files
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: medium
---
When the diff covers more than 15 files, prioritize reading files with the largest diffs first to ensure the most impactful changes get full context. For very large individual files, read only the regions around changed lines with roughly 50 lines of surrounding context rather than the entire file.

**Why:** Bounds context consumption while preserving review quality on the changes most likely to contain substantive issues.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
