---
id: 6
group: "configuration"
dependencies: [5]
status: "completed"
created: "2026-03-05"
skills:
  - github-actions
  - typescript
---
# CI Workflow and Documentation Updates

## Objective
Add a webapp e2e job to `.github/workflows/ci.yml` and update `AGENTS.md` to document the two-tier test approach.

## Skills Required
- github-actions (CI workflow configuration)
- typescript (documentation of test scripts)

## Acceptance Criteria
- [ ] `.github/workflows/ci.yml` has an `e2e` job that runs `npm run test:e2e`
- [ ] CI job installs Chromium via `npx playwright install --with-deps chromium`
- [ ] CI job uploads `test-results/` on failure
- [ ] CI header comment no longer says "E2E tests are disabled"
- [ ] `AGENTS.md` documents `npm run test:e2e` (webapp, CI) and `npm run test:e2e:electron` (local only)
- [ ] No references to `test:e2e:webapp` remain in AGENTS.md

## Technical Requirements
- CI job: ubuntu-latest, Node 22, `npm ci` → `npx playwright install --with-deps chromium` → `npm run test:e2e`
- Upload artifact step uses `actions/upload-artifact@v4` with `if: failure()`
- Match existing CI job patterns (node version, caching, etc.)

## Input Dependencies
- Task 5: `test:e2e` script must be correctly configured to run webapp tests

## Output Artifacts
- Updated `.github/workflows/ci.yml`
- Updated `AGENTS.md`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### CI workflow (`.github/workflows/ci.yml`)

Add `e2e` job after `unit-test`:

```yaml
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: e2e-test-results
          path: test-results/
          retention-days: 7
```

Remove or update the header comment that says "E2E tests are disabled because they are too flaky".

### AGENTS.md

Find the E2E Tests section and update:

**Running tests:**
- `npm run test:e2e` — Webapp e2e tests (runs in CI, fast, no packaging needed)
- `npm run test:e2e:headed` — Webapp e2e with visible browser
- `npm run test:e2e:electron` — Electron e2e tests (local only, requires packaging + xvfb)
- `npm run test:e2e:electron:headed` — Electron e2e with visible browser

Remove all references to `test:e2e:webapp`.

Update any text that says e2e tests require packaging or xvfb — that now only applies to `test:e2e:electron`.

</details>
