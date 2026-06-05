---
schema_version: 1
id: practice-keep-self-review-local-only-with-no-network-access
title: Keep self-review local-only with no network access
kind: practice
tags:
  - privacy
  - network
  - local
derived_from:
  - README.md
relates_to: []
confidence: high
summary: >-
  No network access, no accounts, no telemetry. Code stays on the user's
  machine.
---
A core design principle: "Local-only. No network access, no accounts, no telemetry. Your code stays on your machine."

**Why:** The tool exists specifically to avoid pushing unfinished AI-generated code to remote servers. Adding network features would defeat the purpose.

**How to apply:** Reject features that require network calls, account systems, or telemetry. (Note: AGENTS.md documents one exception — a non-blocking GitHub Releases version check on startup.)
