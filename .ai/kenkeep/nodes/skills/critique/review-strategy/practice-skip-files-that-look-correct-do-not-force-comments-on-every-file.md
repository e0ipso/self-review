---
type: practice
title: Skip files that look correct; do not force comments on every file
description: >-
  Critique should be substantive — emit zero comments for files without real
  issues rather than padding output.
tags:
  - self-review
  - critique
  - scope
kk_schema_version: 3
kk_id: practice-skip-files-that-look-correct-do-not-force-comments-on-every-file
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The skill explicitly directs reviewers to skip files that look correct rather than force comments. Prioritize bugs and security over style nitpicks. Keep comment bodies concise (1-3 sentences).

**Why:** Forced comments dilute signal for the human reviewer who must then triage each item.

**How to apply:** It is valid (and expected) to emit `<file>` entries with no nested `<comment>` children for files that needed no critique.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
