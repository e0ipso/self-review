---
type: practice
title: >-
  Resolve the active KB harness and pass `--harness "$HARNESS"` to every CLI
  call
description: >-
  Detect the active harness via the kb-detect-harness script before running CLI
  commands, then pass `--harness "$HARNESS"` to each call.
tags:
  - knowledge-base
  - harness
  - cli
kk_schema_version: 3
kk_id: >-
  practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call
kk_derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Run the materialization block to lazy-write `/tmp/kb-detect-harness.mjs` (first invocation only), then resolve with `HARNESS=$(node /tmp/kb-detect-harness.mjs --hint <hint>)`. Substitute `<hint>` with your best-guess runtime id (`claude`, `codex`, `cursor`, or `opencode`).

**Why:** CLI commands route behavior per harness; an unset or wrong harness silently produces incorrect output. **How to apply:** Resolve once at the start of the skill, then pass `--harness "$HARNESS"` to every subsequent CLI invocation.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-bootstrap/SKILL.md](.cursor/skills/kb-bootstrap/SKILL.md)
<!-- kk:citations:end -->
