---
type: map
title: ai-knowledge-base CLI
description: >-
  `npx @e0ipso/ai-knowledge-base` provides `bootstrap-incremental` and `index
  rebuild` subcommands used by kb-bootstrap.
tags:
  - knowledge-base
  - cli
kk_schema_version: 3
kk_id: map-ai-knowledge-base-cli
kk_derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The `@e0ipso/ai-knowledge-base` npm package exposes CLI commands consumed by the kb-bootstrap skill:

- `bootstrap-incremental --harness <id> --dry-run --from <scope>` — lists candidate markdown files after applying gitignore, project rules, and the static skip list.
- `index rebuild --harness <id>` — refreshes `INDEX.md` and `GRAPH.md` after nodes are written.

Both commands require an explicit `--harness` argument.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-bootstrap/SKILL.md](.cursor/skills/kb-bootstrap/SKILL.md)
<!-- kk:citations:end -->
