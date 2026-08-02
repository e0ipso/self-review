---
type: map
title: KB harness detection script at /tmp/kb-detect-harness.mjs
description: >-
  Node script that resolves the active KB harness id, mirroring
  src/harnesses/detect.ts resolveWithHint priority.
tags:
  - kb
  - harness
  - detection
kk_schema_version: 3
kk_id: map-kb-harness-detection-script-at-tmp-kb-detect-harness-mjs
kk_derived_from:
  - .cursor/skills/kb-curate/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`/tmp/kb-detect-harness.mjs` is a Node script materialized lazily by the kb-curate skill. It resolves the active harness id from one of four registered ids (`claude`, `codex`, `cursor`, `opencode`) using this priority: (1) `--hint <id>` argv if registered; (2) environment detection (`CLAUDECODE=1` → `claude`, `CURSOR_VERSION` nonempty → `cursor`); (3) `cliDefaultHarness` in `.ai/knowledge-base/config.yaml` of the nearest repo root (located by walking up looking for `.ai/knowledge-base`). Exits 2 with a stderr message if none resolve.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-curate/SKILL.md](.cursor/skills/kb-curate/SKILL.md)
<!-- kk:citations:end -->
