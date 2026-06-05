---
schema_version: 1
id: map-kb-detect-harness-helper-script
title: kb-detect-harness helper script
kind: map
tags:
  - knowledge-base
  - harness
  - detection
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  `/tmp/kb-detect-harness.mjs` resolves the active KB harness id by hint, env
  vars, or `cliDefaultHarness` in KB config.
---
A Node.js helper materialized to `/tmp/kb-detect-harness.mjs` on first invocation. It mirrors `src/harnesses/detect.ts`'s `resolveWithHint` priority: explicit `--hint` argument first, then environment-variable detection (e.g. `CLAUDECODE=1` → `claude`, `CURSOR_VERSION` non-empty → `cursor`), then `cliDefaultHarness` from `.ai/knowledge-base/config.yaml`.

Registered harness ids: `claude`, `codex`, `cursor`, `opencode`. Exits with code 2 and a stderr message when none can be resolved.
