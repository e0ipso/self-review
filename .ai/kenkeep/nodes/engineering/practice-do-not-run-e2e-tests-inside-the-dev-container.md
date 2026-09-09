---
type: practice
title: Do not run e2e tests inside the dev container
description: >-
  E2E tests require a host machine with display; check for dev container before
  running them.
tags:
  - strikethroo
  - testing
  - devcontainer
kk_schema_version: 3
kk_id: practice-do-not-run-e2e-tests-inside-the-dev-container
kk_derived_from:
  - AGENTS.md
kk_relates_to:
  - map-self-review
kk_depends_on: []
kk_confidence: high
---
E2E tests use Playwright with Cucumber and cannot run in the dev container. Always check whether you are inside the dev container before attempting `npm run test:e2e:electron` or related commands. Unit tests work in both the container and the host.

**Why:** E2E tests need a display server (xvfb) and Electron packaging that are not available inside the dev container environment.

<!-- kk:citations:start -->
# Citations

[1] [AGENTS.md](../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-self-review](../app/map-self-review.md)
<!-- kk:related:end -->
