---
type: practice
title: Make zero network requests except the startup version check
description: >-
  No telemetry, analytics, or CDN fetches; only the startup version check and
  user-triggered remote PR/MR review touch the network.
tags:
  - strikethroo
  - network
  - privacy
kk_schema_version: 3
kk_id: practice-make-zero-network-requests-except-the-startup-version-check
kk_derived_from:
  - AGENTS.md
kk_relates_to:
  - map-self-review
kk_depends_on: []
kk_confidence: high
---
The app makes zero network requests at runtime, with two exceptions. First, on startup it makes a single non-blocking request to `api.github.com` to check for updates; this request is fire-and-forget, and any failure (offline, timeout, firewall) is silently ignored. Second, when the user supplies a forge PR/MR URL (remote mode), the network is touched only for that URL: git clone/fetch through git's own credential machinery, and the `gh`/`glab` CLIs for base-branch lookup and thread fetch only. Every remote-mode request is user-triggered, and nothing is ever sent to the forge. No telemetry, no analytics, no CDN fetches. All assets are bundled.

**Why:** Local-only desktop app for solo developers; privacy and offline operation are core design goals.

<!-- kk:citations:start -->
# Citations

[1] [AGENTS.md](../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-self-review](map-self-review.md)
<!-- kk:related:end -->
