---
type: practice
title: Make no network connections at runtime
description: >-
  The app is local-first: no network calls except the startup version check
  and user-triggered remote PR/MR review; nothing is sent to the forge.
tags:
  - network
  - privacy
  - local-only
kk_schema_version: 3
kk_id: practice-make-no-network-connections-at-runtime
kk_derived_from:
  - docs/PRD.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The application does not open any network connections, with two documented exceptions: the non-blocking startup version check, and remote PR/MR review, where a user-supplied forge URL triggers git clone/fetch (git's own credentials) and read-only `gh`/`glab` calls for base-branch lookup and thread fetch. All other operations are local, and nothing is ever sent to the forge. No telemetry, no analytics, no auto-updates. All assets are bundled.

Rationale: the primary use case is reviewing AI-generated code that may be unfinished, experimental, or private — pushing it to a remote server (even GitHub) defeats the purpose of a local review tool.

<!-- kk:citations:start -->
# Citations

[1] [docs/PRD.md](docs/PRD.md)
<!-- kk:citations:end -->
