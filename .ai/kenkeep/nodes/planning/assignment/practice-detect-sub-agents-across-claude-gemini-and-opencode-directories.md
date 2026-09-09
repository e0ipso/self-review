---
type: practice
title: 'Discover agents through the active harness'
description: >-
  Use the current harness agents directory, with general-purpose fallback.
tags:
  - agents
  - discovery
  - conventions
kk_schema_version: 3
kk_id: practice-detect-sub-agents-across-claude-gemini-and-opencode-directories
kk_derived_from:
  - .ai/strikethroo/config/hooks/PRE_TASK_ASSIGNMENT.md
kk_relates_to:
  - map-pre-task-assignment-hook
kk_depends_on: []
kk_confidence: high
---
Check the active harness agents directory for task-matching capabilities. If none are available or none match, use a general-purpose agent. The current hook does not mandate a fixed search order across Claude, Gemini and OpenCode directories.

<!-- kk:citations:start -->
# Citations

[1] [.ai/strikethroo/config/hooks/PRE_TASK_ASSIGNMENT.md](../../../../strikethroo/config/hooks/PRE_TASK_ASSIGNMENT.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-pre-task-assignment-hook](map-pre-task-assignment-hook.md)
<!-- kk:related:end -->
