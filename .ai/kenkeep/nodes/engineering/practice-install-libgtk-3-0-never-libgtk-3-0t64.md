---
type: practice
title: 'Install libgtk-3-0, never libgtk-3-0t64'
description: >-
  libgtk-3-0 is virtual on Ubuntu noble but installs through Provides; the t64
  spelling breaks the Debian 12 dev container.
tags:
  - apt
  - ubuntu
  - debian
  - devcontainer
  - ci
  - electron
kk_schema_version: 3
kk_id: practice-install-libgtk-3-0-never-libgtk-3-0t64
kk_derived_from: []
kk_relates_to:
  - practice-run-the-webapp-e2e-project-in-the-dev-container
kk_depends_on: []
kk_confidence: high
---
Two places install the GTK runtime Electron needs: the `packages` list in
`.devcontainer/devcontainer.json` (Debian 12) and the apt line in the `electron-e2e` job of
`.github/workflows/ci.yml` (`ubuntu-latest`, currently Ubuntu 24.04 noble). Both spell it
`libgtk-3-0`, and both must keep spelling it that way.

On noble, `apt-cache policy libgtk-3-0` reports `Candidate: (none)`, which reads like the package is
gone and invites a "fix" to `libgtk-3-0t64`. The name is still there. It is a virtual package, and
`libgtk-3-0t64` is its only provider through `Provides:`, so apt has one candidate to pick.
Simulated against the real noble indices,
`apt-get -s install -y --no-install-recommends xauth libgtk-3-0 xvfb` exits 0 and selects
`libgtk-3-0t64 3.24.41-4ubuntu1.3`. Debian 12 has no `t64` transition at all, so the concrete
spelling would fail there outright.

**Why:** `libgtk-3-0` is the one spelling that works on both distributions, and the diagnostic
arguing against it is misleading. Run `apt-get -s install` before believing `apt-cache policy` about
a name that looks unavailable.

<!-- kk:related:start -->
# Related

- Related: [practice-run-the-webapp-e2e-project-in-the-dev-container](/engineering/practice-run-the-webapp-e2e-project-in-the-dev-container.md)
<!-- kk:related:end -->
