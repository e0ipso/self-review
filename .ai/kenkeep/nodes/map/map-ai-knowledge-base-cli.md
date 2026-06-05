---
schema_version: 1
id: map-ai-knowledge-base-cli
title: ai-knowledge-base CLI
kind: map
tags:
  - knowledge-base
  - cli
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  `npx @e0ipso/ai-knowledge-base` provides `bootstrap-incremental` and `index
  rebuild` subcommands used by kb-bootstrap.
---
The `@e0ipso/ai-knowledge-base` npm package exposes CLI commands consumed by the kb-bootstrap skill:

- `bootstrap-incremental --harness <id> --dry-run --from <scope>` — lists candidate markdown files after applying gitignore, project rules, and the static skip list.
- `index rebuild --harness <id>` — refreshes `INDEX.md` and `GRAPH.md` after nodes are written.

Both commands require an explicit `--harness` argument.
