---
type: map
title: PRE_TASK_ASSIGNMENT hook
description: >-
  Match task skills and domain to available agents in the active harness.
tags:
  - hooks
  - strikethroo
  - ai
kk_schema_version: 3
kk_id: map-pre-task-assignment-hook
kk_derived_from:
  - .ai/strikethroo/config/hooks/PRE_TASK_ASSIGNMENT.md
kk_relates_to:
  - map-extract-task-skills-cjs
  - practice-detect-sub-agents-across-claude-gemini-and-opencode-directories
  - practice-engage-relevant-assistant-skills-based-on-task-skills
  - practice-match-task-skills-to-sub-agents-during-pre-task-assignment
kk_depends_on: []
kk_confidence: high
---
The hook at `.ai/strikethroo/config/hooks/PRE_TASK_ASSIGNMENT.md` reads task frontmatter skills, considers the technical domain and complexity, and checks the current harness agents directory. Select a matching agent or fall back to a general-purpose agent. Engage relevant assistant skills across the phase.

<!-- kk:citations:start -->
# Citations

[1] [.ai/strikethroo/config/hooks/PRE_TASK_ASSIGNMENT.md](../../../../strikethroo/config/hooks/PRE_TASK_ASSIGNMENT.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-extract-task-skills-cjs](map-extract-task-skills-cjs.md)
- Related: [practice-detect-sub-agents-across-claude-gemini-and-opencode-directories](practice-detect-sub-agents-across-claude-gemini-and-opencode-directories.md)
- Related: [practice-engage-relevant-assistant-skills-based-on-task-skills](practice-engage-relevant-assistant-skills-based-on-task-skills.md)
- Related: [practice-match-task-skills-to-sub-agents-during-pre-task-assignment](practice-match-task-skills-to-sub-agents-during-pre-task-assignment.md)
<!-- kk:related:end -->
