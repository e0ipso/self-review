---
schema_version: 1
id: map-e0ipso-ai-knowledge-base-cli-commands-used-by-kb-curate
title: '@e0ipso/ai-knowledge-base CLI commands used by kb-curate'
kind: map
tags:
  - kb-curate
  - cli
  - subcommands
derived_from:
  - .cursor/skills/kb-curate/SKILL.md
relates_to: []
confidence: high
summary: >-
  `curate --harness <id>` runs the curator; `index rebuild --harness <id>
  --stage` regenerates INDEX/GRAPH for pre-commit hooks.
---
The `@e0ipso/ai-knowledge-base` npm package exposes the commands used by the kb-curate workflow:

- `curate --harness "$HARNESS"` — acquires the curator lock, batches pending session logs (`proposal_status: done`, not yet curated), spawns a curator subprocess per batch (with `KB_BUILDER_INTERNAL=1` to prevent recursion), writes node files and conflict files, and regenerates `INDEX.md`/`GRAPH.md`. Stdout reports `Curator finished: N node(s) written, M drop(s) over K batch(es).`, `Run id: <runId>`, conflict warnings, and a `failure(s)` list for `add_collision`/`modify_missing_target`.
- `index rebuild --harness "$HARNESS" --stage` — regenerates and stages INDEX/GRAPH; intended for pre-commit hooks on hand edits.
