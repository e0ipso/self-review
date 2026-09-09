---
type: practice
title: >-
  Run the webapp e2e project in the dev container; only Electron e2e needs a
  host
description: >-
  npm run test:e2e is headless Chromium and passes in the container; only npm
  run test:e2e:electron needs packaging and a display.
tags:
  - testing
  - e2e
  - playwright
  - devcontainer
kk_schema_version: 3
kk_id: practice-run-the-webapp-e2e-project-in-the-dev-container
kk_derived_from: []
kk_relates_to:
  - map-testing-layers-unit-e2e
kk_depends_on: []
kk_confidence: high
---
`playwright.config.ts` declares four projects, and only one of them is host-only. `npm run test:e2e`
runs the `e2e` project: headless Chromium against a Vite dev server serving `@self-review/react`
fixtures, no display and no Electron package. It passes inside this dev container: 70/70, exit 0, with
`DISPLAY` unset. `npm run test:e2e:electron` runs the `electron` project, which shells out to
`npm run package` and then `xvfb-run`. That one cannot run in the container, because it needs a
display and `DISPLAY` is unset.

So "e2e tests cannot run in the dev container" is false, and acting on it drops the tier AGENTS.md
calls primary and the only tier CI runs. Check which project a command targets before you skip it.
The webapp project needs its browser installed first. See the Playwright browser-install practice.

**Why:** The container restriction is about a display and an Electron package, not about Playwright.
Only the `electron` project needs either.

<!-- kk:related:start -->
# Related

- Related: [map-testing-layers-unit-e2e](/engineering/map-testing-layers-unit-e2e.md)
<!-- kk:related:end -->
