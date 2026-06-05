---
schema_version: 1
id: practice-defer-file-discovery-to-the-cli-s-bootstrap-incremental-dry-run
title: Defer file discovery to the CLI's bootstrap-incremental dry run
kind: practice
tags:
  - knowledge-base
  - cli
  - discovery
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  Use `npx @e0ipso/ai-knowledge-base bootstrap-incremental --dry-run` to list
  candidate files; do not rebuild discovery yourself.
---
Run `npx @e0ipso/ai-knowledge-base bootstrap-incremental --harness "$HARNESS" --dry-run --from <scope>` once and parse the `  + <relpath>` lines. The CLI already applies `.gitignore`, project include/exclude rules, and a static skip list (`LICENSE`, `CHANGELOG`, `CODE_OF_CONDUCT`, `CONTRIBUTORS`, `INDEX.md`, `GRAPH.md`, `releases/**/*.md`).

**Why:** The CLI owns file discovery, hashing, and state. **How to apply:** Count and report briefly to the user before reading in depth, then prioritize entry points from the deterministic list.
