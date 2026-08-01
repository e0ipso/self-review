---
type: practice
title: 'Detect sub-agents across .claude, .gemini, and .opencode directories'
description: >-
  Sub-agent availability is determined by scanning the `agents/` subdirectory of
  each supported assistant directory.
tags:
  - agents
  - discovery
  - conventions
kk_schema_version: 3
kk_id: practice-detect-sub-agents-across-claude-gemini-and-opencode-directories
kk_derived_from:
  - .ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The PRE_TASK_ASSIGNMENT hook checks `.claude/agents`, `.gemini/agents`, and `.opencode/agents` for available sub-agents. The first non-empty directory found is treated as the source of available agents.

If none of these directories exist or all are empty, the hook falls back to a general-purpose agent. Place sub-agent definitions under one of these paths so the hook can discover them.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md](.ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md)
<!-- kk:citations:end -->
