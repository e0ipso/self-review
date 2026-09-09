---
type: practice
title: 'Score and refine generated task complexity'
description: >-
  Keep tasks single-purpose with runnable acceptance checks and one or two
  skills.
tags:
  - strikethroo
  - planning
  - quality
kk_schema_version: 3
kk_id: practice-review-every-generated-task-for-complexity-vagueness-and-triviality
kk_derived_from:
  - .agents/skills/st-generate-tasks/SKILL.md
kk_relates_to:
  - map-post-task-generation-all-hook
kk_depends_on: []
kk_confidence: high
---
During task generation, assign complexity_score from 1 to 10 using the skill rubric. Scores of 8 or more require decomposition; 6–7 require sharpening or splitting unless explicitly justified. Sharpen vague acceptance criteria into runnable checks and merge trivial adjacent tasks. Re-run dependency analysis and scoring after adjustments, up to three passes. Three or more required skills means a task must be split.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/st-generate-tasks/SKILL.md](../../../../../.agents/skills/st-generate-tasks/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-post-task-generation-all-hook](map-post-task-generation-all-hook.md)
<!-- kk:related:end -->
