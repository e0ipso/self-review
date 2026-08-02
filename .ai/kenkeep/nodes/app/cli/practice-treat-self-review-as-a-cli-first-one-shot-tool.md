---
type: practice
title: 'Treat self-review as a CLI-first, one-shot tool'
description: >-
  self-review launches from the terminal, writes review output to a file, then
  exits. No servers or persistent state.
tags:
  - cli
  - workflow
  - output
kk_schema_version: 3
kk_id: practice-treat-self-review-as-a-cli-first-one-shot-tool
kk_derived_from:
  - README.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
self-review is designed as a Unix-style CLI tool: "Launched from the terminal, writes review output to a file. Behaves like a Unix tool." The workflow is one-shot: open → review → close → done.

**Why:** The design principles explicitly state "One-shot. Open → review → close → done. No servers, no persistent state."

**How to apply:** Don't add long-running server modes, persistent background processes, or stateful daemons. Features should fit the open/review/close lifecycle.

<!-- kk:citations:start -->
# Citations

[1] [README.md](README.md)
<!-- kk:citations:end -->
