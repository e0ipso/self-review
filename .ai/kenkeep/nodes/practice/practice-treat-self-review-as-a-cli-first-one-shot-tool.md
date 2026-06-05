---
schema_version: 1
id: practice-treat-self-review-as-a-cli-first-one-shot-tool
title: 'Treat self-review as a CLI-first, one-shot tool'
kind: practice
tags:
  - cli
  - workflow
  - output
derived_from:
  - README.md
relates_to: []
confidence: high
summary: >-
  self-review launches from the terminal, writes review output to a file, then
  exits. No servers or persistent state.
---
self-review is designed as a Unix-style CLI tool: "Launched from the terminal, writes review output to a file. Behaves like a Unix tool." The workflow is one-shot: open → review → close → done.

**Why:** The design principles explicitly state "One-shot. Open → review → close → done. No servers, no persistent state."

**How to apply:** Don't add long-running server modes, persistent background processes, or stateful daemons. Features should fit the open/review/close lifecycle.
