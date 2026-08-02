---
type: map
title: kb-detect-harness helper script
description: >-
  `/tmp/kb-detect-harness.mjs` resolves the active KB harness id by hint, env
  vars, or `cliDefaultHarness` in KB config.
tags:
  - knowledge-base
  - harness
  - detection
kk_schema_version: 3
kk_id: map-kb-detect-harness-helper-script
kk_derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
A Node.js helper materialized to `/tmp/kb-detect-harness.mjs` on first invocation. It mirrors `src/harnesses/detect.ts`'s `resolveWithHint` priority: explicit `--hint` argument first, then environment-variable detection (e.g. `CLAUDECODE=1` → `claude`, `CURSOR_VERSION` non-empty → `cursor`), then `cliDefaultHarness` from `.ai/knowledge-base/config.yaml`.

Registered harness ids: `claude`, `codex`, `cursor`, `opencode`. Exits with code 2 and a stderr message when none can be resolved.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-bootstrap/SKILL.md](.cursor/skills/kb-bootstrap/SKILL.md)
<!-- kk:citations:end -->
