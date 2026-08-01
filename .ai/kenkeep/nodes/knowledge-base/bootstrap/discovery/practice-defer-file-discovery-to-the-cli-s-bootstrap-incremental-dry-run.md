---
type: practice
title: Defer file discovery to the CLI's bootstrap-incremental dry run
description: >-
  Use `npx @e0ipso/ai-knowledge-base bootstrap-incremental --dry-run` to list
  candidate files; do not rebuild discovery yourself.
tags:
  - knowledge-base
  - cli
  - discovery
kk_schema_version: 3
kk_id: practice-defer-file-discovery-to-the-cli-s-bootstrap-incremental-dry-run
kk_derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Run `npx @e0ipso/ai-knowledge-base bootstrap-incremental --harness "$HARNESS" --dry-run --from <scope>` once and parse the `  + <relpath>` lines. The CLI already applies `.gitignore`, project include/exclude rules, and a static skip list (`LICENSE`, `CHANGELOG`, `CODE_OF_CONDUCT`, `CONTRIBUTORS`, `INDEX.md`, `GRAPH.md`, `releases/**/*.md`).

**Why:** The CLI owns file discovery, hashing, and state. **How to apply:** Count and report briefly to the user before reading in depth, then prioritize entry points from the deterministic list.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-bootstrap/SKILL.md](.cursor/skills/kb-bootstrap/SKILL.md)
<!-- kk:citations:end -->
