---
schema_version: 1
id: practice-detect-sub-agents-across-claude-gemini-and-opencode-directories
title: 'Detect sub-agents across .claude, .gemini, and .opencode directories'
kind: practice
tags:
  - agents
  - discovery
  - conventions
derived_from:
  - .ai/task-manager/config/hooks/PRE_TASK_ASSIGNMENT.md
relates_to: []
confidence: high
summary: >-
  Sub-agent availability is determined by scanning the `agents/` subdirectory of
  each supported assistant directory.
---
The PRE_TASK_ASSIGNMENT hook checks `.claude/agents`, `.gemini/agents`, and `.opencode/agents` for available sub-agents. The first non-empty directory found is treated as the source of available agents.

If none of these directories exist or all are empty, the hook falls back to a general-purpose agent. Place sub-agent definitions under one of these paths so the hook can discover them.
