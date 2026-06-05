---
schema_version: 1
id: practice-refresh-index-md-and-graph-md-after-writing-nodes
title: Refresh INDEX.md and GRAPH.md after writing nodes
kind: practice
tags:
  - knowledge-base
  - cli
  - indexing
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  Run `npx @e0ipso/ai-knowledge-base index rebuild` after writing nodes so the
  indices reflect them before reviewer diff.
---
After writing nodes, run `npx @e0ipso/ai-knowledge-base index rebuild --harness "$HARNESS"`.

**Why:** The reviewer inspects `git diff nodes/` plus the indices; stale indices hide newly-added nodes. **How to apply:** Always run the rebuild before reporting back to the user.
