---
type: practice
title: Keep self-review local-only with no network access
description: >-
  No network access, no accounts, no telemetry. Code stays on the user's
  machine.
tags:
  - privacy
  - network
  - local
kk_schema_version: 3
kk_id: practice-keep-self-review-local-only-with-no-network-access
kk_derived_from:
  - README.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
A core design principle: "Local-only. No network access, no accounts, no telemetry. Your code stays on your machine."

**Why:** The tool exists specifically to avoid pushing unfinished AI-generated code to remote servers. Adding network features would defeat the purpose.

**How to apply:** Reject features that require network calls, account systems, or telemetry. (Note: AGENTS.md documents two exceptions — a non-blocking GitHub Releases version check on startup, and remote PR/MR review, where the network is touched only for a user-supplied forge URL and nothing is ever sent to the forge.)

<!-- kk:citations:start -->
# Citations

[1] [README.md](README.md)
<!-- kk:citations:end -->
