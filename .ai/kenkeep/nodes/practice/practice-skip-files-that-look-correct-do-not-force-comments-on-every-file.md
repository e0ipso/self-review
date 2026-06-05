---
schema_version: 1
id: practice-skip-files-that-look-correct-do-not-force-comments-on-every-file
title: Skip files that look correct; do not force comments on every file
kind: practice
tags:
  - self-review
  - critique
  - scope
derived_from:
  - .agents/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  Critique should be substantive — emit zero comments for files without real
  issues rather than padding output.
---
The skill explicitly directs reviewers to skip files that look correct rather than force comments. Prioritize bugs and security over style nitpicks. Keep comment bodies concise (1-3 sentences).

**Why:** Forced comments dilute signal for the human reviewer who must then triage each item.

**How to apply:** It is valid (and expected) to emit `<file>` entries with no nested `<comment>` children for files that needed no critique.
