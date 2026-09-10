---
type: practice
title: >-
  Both e2e projects run in the dev container; the Electron tier needs two apt
  packages
description: >-
  npm run test:e2e and npm run test:e2e:electron both pass in the container once
  xauth and libgtk-3-0 are installed.
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
  - practice-install-libgtk-3-0-never-libgtk-3-0t64
kk_depends_on: []
kk_confidence: high
---
`playwright.config.ts` declares four projects, and both of the ones the test scripts drive run in
this dev container. `npm run test:e2e` runs the `e2e` project: headless Chromium against a Vite dev
server serving `@self-review/react` fixtures, no display and no Electron package. It passes with
`DISPLAY` unset, 70/70, exit 0. `npm run test:e2e:electron` runs the `electron` project, which shells
out to `npm run package` and then `xvfb-run --auto-servernum`. Measured at f1e4eae with the two
packages below installed: 38 passed in 59.5s, exit 0.

Those two packages are what the base `node:24` image leaves out, and
`.devcontainer/devcontainer.json:26` now installs them. Without `xauth`, `xvfb-run` aborts with
`xvfb-run: error: xauth command not found` and the run exits 3 before a test starts. Without
`libgtk-3-0`, every scenario dies at launch on `libgtk-3.so.0`. Find the set by measurement, not from
memory: `ldd node_modules/electron/dist/electron` names one missing library at a time, so install,
re-run `ldd`, and repeat. After `libgtk-3-0` it reported nothing missing. A container built before
this change needs `sudo apt-get install -y xauth libgtk-3-0` once.

A display was never the blocker. `xvfb-run` is installed and the script passes `--auto-servernum`,
which starts its own X server, so an unset `DISPLAY` costs nothing. Neither is the Chromium sandbox:
launching the Electron binary by hand aborts on the SUID helper, but `tests/steps/app.ts:31-37`
already passes `--no-sandbox`, `--disable-setuid-sandbox` and `--disable-namespace-sandbox`, so the
suite never reaches that abort.

The tier now runs in CI too, as the `electron-e2e` job in `.github/workflows/ci.yml`, gated by
`if: github.event_name != 'pull_request'` so it fires on pushes to `main` and on
`workflow_dispatch` but never on a pull request. It installs `xauth`, `libgtk-3-0` and `xvfb` on the
runner before `npm ci`. It stays off the PR path because it packages the app, which no other job
does, and it cannot reuse another job's `npm ci`. `npm run package` costs 34s, `npx bddgen` 2s and
the Playwright `electron` project 56s, about 91s for `npm run test:e2e:electron` end to end. That
makes it the slowest job in the graph.

**Why:** "e2e tests cannot run in the dev container" was always a claim about OS packages the image
left out, and both tiers run once those are present. The webapp project still needs its browser
installed first; see the Playwright browser-install practice.

<!-- kk:related:start -->
# Related

- Related: [map-testing-layers-unit-e2e](/engineering/map-testing-layers-unit-e2e.md)
<!-- kk:related:end -->
