---
schema_version: 1
id: map-knowledge-base-capture-curate-review-workflow
title: Knowledge-base capture-curate-review workflow
kind: map
tags:
  - knowledge-base
  - workflow
  - skills
derived_from:
  - .ai/knowledge-base/README.md
relates_to: []
confidence: high
summary: >-
  Sessions capture to _sessions/, /kb-curate writes nodes, git diff reviews,
  future sessions consume via injected INDEX.md.
---
The KB lifecycle has four stages:

1. **Capture.** A hook during AI sessions records redacted transcript slices to `_sessions/`.
2. **Curate.** Run `/kb-curate` or `npx @e0ipso/ai-knowledge-base curate` to process pending sessions; the curator applies `add`/`modify` decisions directly to `nodes/` and writes contradictions to `conflicts/`.
3. **Review.** Changes appear in `git status`; inspect with `git diff`, accept with `git commit`, reject with `git restore <file>`.
4. **Consume.** A `SessionStart` hook injects `INDEX.md` (token-budgeted) into every new AI session.

Manual node creation paths: `/kb-add` from inside Claude Code, or `npx @e0ipso/ai-knowledge-base node add` interactively from the terminal. Initial seeding from existing docs uses `/kb-bootstrap` (one-time, supervised) or `npx @e0ipso/ai-knowledge-base bootstrap-incremental --from docs/` for incremental updates.
