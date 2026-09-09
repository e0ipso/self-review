---
type: practice
title: >-
  Install Playwright's Chromium and its system libraries before the first e2e
  run
description: >-
  A fresh container needs npx playwright install chromium plus sudo npx
  playwright install-deps chromium, or Chromium fails on libnspr4.so.
tags:
  - testing
  - e2e
  - playwright
  - devcontainer
  - setup
kk_schema_version: 3
kk_id: >-
  practice-install-playwright-chromium-and-its-system-libraries-before-the-first-e2e-run
kk_derived_from: []
kk_relates_to:
  - practice-run-the-webapp-e2e-project-in-the-dev-container
  - map-testing-layers-unit-e2e
kk_depends_on: []
kk_confidence: high
---
Playwright browsers are not part of `npm install`, and they are keyed to the Playwright version, so a
container that was fine for an older version can still be missing the browser. Before the first
`npm run test:e2e` in a fresh environment, run both halves:

```bash
npx playwright install chromium
sudo npx playwright install-deps chromium
```

The second command is the one that gets forgotten. Without it Chromium is on disk but will not
launch, and the failure surfaces as `error while loading shared libraries: libnspr4.so` rather than
as anything resembling a missing dependency. `.cursor/cloud-instructions.md` records the first
command for the Cursor Cloud VM only, and its test count is stale; the requirement applies to any
fresh checkout or container.

**Why:** Browsers live in `~/.cache/ms-playwright`, outside the repo and outside `node_modules`, so
nothing in the repo's install step can put them there.

<!-- kk:related:start -->
# Related

- Related: [practice-run-the-webapp-e2e-project-in-the-dev-container](/engineering/practice-run-the-webapp-e2e-project-in-the-dev-container.md)
- Related: [map-testing-layers-unit-e2e](/engineering/map-testing-layers-unit-e2e.md)
<!-- kk:related:end -->
