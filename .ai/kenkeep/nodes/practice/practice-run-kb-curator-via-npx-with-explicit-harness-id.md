---
schema_version: 1
id: practice-run-kb-curator-via-npx-with-explicit-harness-id
title: Run kb curator via npx with explicit harness id
kind: practice
tags:
  - kb-curate
  - cli
  - harness
derived_from:
  - .cursor/skills/kb-curate/SKILL.md
relates_to: []
confidence: high
summary: >-
  Curate pending session logs with `npx @e0ipso/ai-knowledge-base@latest curate
  --harness "$HARNESS"` using the resolved harness id.
---
Run the curator from the project root with `npx --yes @e0ipso/ai-knowledge-base@latest curate --harness "$HARNESS"`. The command acquires a curator lock, batches session logs whose `proposal_status: done` have not been curated, writes nodes directly to `.ai/knowledge-base/nodes/<kind>/`, writes contradictions to `.ai/knowledge-base/conflicts/<id>.md`, and regenerates `INDEX.md` and `GRAPH.md`.

**Why:** The curator wrapper handles locking, batching, and index regeneration; bypassing it risks stale indexes and concurrent runs.

**How to apply:** Always resolve `$HARNESS` first via the `/tmp/kb-detect-harness.mjs` materialization block (hints: `claude`, `codex`, `cursor`, `opencode`). If the command reports `locked`, do not retry — another curate run is in progress.
