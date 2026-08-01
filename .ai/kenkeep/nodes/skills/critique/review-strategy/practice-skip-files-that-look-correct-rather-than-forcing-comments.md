---
type: practice
title: Skip files that look correct rather than forcing comments
description: >-
  Critique should leave a file un-commented when nothing substantive is wrong;
  do not manufacture review comments on every file.
tags:
  - self-review
  - critique
  - scope
kk_schema_version: 3
kk_id: practice-skip-files-that-look-correct-rather-than-forcing-comments
kk_derived_from:
  - .opencode/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
When critiquing a diff, prioritize substantive issues (bugs, security) over style nitpicks, and skip files that appear correct. The goal is signal-to-noise, not coverage.

Use file-level comments (no line attributes) only for architectural or design concerns spanning the whole file. Keep comment bodies to 1-3 sentences.

<!-- kk:citations:start -->
# Citations

[1] [.opencode/skills/self-review-critique/SKILL.md](.opencode/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
