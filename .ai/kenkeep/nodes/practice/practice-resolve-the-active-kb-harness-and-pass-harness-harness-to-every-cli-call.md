---
schema_version: 1
id: >-
  practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call
title: >-
  Resolve the active KB harness and pass `--harness "$HARNESS"` to every CLI
  call
kind: practice
tags:
  - knowledge-base
  - harness
  - cli
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  Detect the active harness via the kb-detect-harness script before running CLI
  commands, then pass `--harness "$HARNESS"` to each call.
---
Run the materialization block to lazy-write `/tmp/kb-detect-harness.mjs` (first invocation only), then resolve with `HARNESS=$(node /tmp/kb-detect-harness.mjs --hint <hint>)`. Substitute `<hint>` with your best-guess runtime id (`claude`, `codex`, `cursor`, or `opencode`).

**Why:** CLI commands route behavior per harness; an unset or wrong harness silently produces incorrect output. **How to apply:** Resolve once at the start of the skill, then pass `--harness "$HARNESS"` to every subsequent CLI invocation.
