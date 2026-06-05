---
schema_version: 1
id: practice-skip-files-that-look-correct-rather-than-forcing-comments
title: Skip files that look correct rather than forcing comments
kind: practice
tags:
  - self-review
  - critique
  - scope
derived_from:
  - .opencode/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  Critique should leave a file un-commented when nothing substantive is wrong;
  do not manufacture review comments on every file.
---
When critiquing a diff, prioritize substantive issues (bugs, security) over style nitpicks, and skip files that appear correct. The goal is signal-to-noise, not coverage.

Use file-level comments (no line attributes) only for architectural or design concerns spanning the whole file. Keep comment bodies to 1-3 sentences.
