---
id: 3
group: 'ci-cd'
dependencies: [1]
status: 'completed'
created: '2026-02-12'
skills:
  - github-actions
  - ci-cd
complexity_score: 5
complexity_notes: 'Single-file workflow but requires E2E Electron expertise (AppArmor, xvfb, caching) and OIDC npm publishing configuration'
---

# Create GitHub Actions CI/CD Workflow

## Objective

Create a single GitHub Actions workflow file (`.github/workflows/ci.yml`) with four jobs — Lint, Unit Tests, E2E Tests, and Release — that gates PR merging on test results and automates semantic-release publishing to npm on `main` pushes. Also update the Playwright config to use a longer timeout in CI environments.

## Skills Required

- github-actions: Workflow YAML authoring, job dependencies, conditional execution, caching, artifact upload
- ci-cd: Semantic-release integration, npm OIDC publishing, Electron CI environment setup

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` exists and is valid YAML
- [ ] Workflow triggers on `push` to `main` and `pull_request` targeting `main`
- [ ] Lint job runs `npm run lint` successfully
- [ ] Unit Tests job runs `npm run test:unit:run` successfully
- [ ] E2E Tests job: disables AppArmor restriction, caches Electron binary, packages the app, generates BDD tests, runs Playwright under xvfb-run, uploads test report artifact
- [ ] Release job: runs only on `main` push, depends on all 3 test jobs passing, uses Node 24, runs `npx semantic-release` with proper permissions (contents: write, issues: write, pull-requests: write, id-token: write)
- [ ] Lint, Unit Tests, and E2E Tests jobs run in parallel
- [ ] Workflow has a comment block at the top explaining structure and AppArmor requirement
- [ ] Release job includes a comment documenting one-time npm Trusted Publishing setup steps
- [ ] `playwright.config.ts` uses 60s timeout when `CI` env var is set, 30s otherwise

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- GitHub Actions `ubuntu-latest` (Ubuntu 24.04) runners
- `actions/checkout@v4`, `actions/setup-node@v4`, `actions/cache@v4`, `actions/upload-artifact@v4`
- Node LTS (22) for test jobs, Node 24 for release job (npm >=11.5.1 for OIDC)
- `xvfb-run --auto-servernum` for E2E test execution
- `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0` for Electron compatibility
- Electron cache path: `~/.cache/electron`, keyed on `package-lock.json` hash
- npm cache via `actions/setup-node` built-in `cache: 'npm'` option
- `GITHUB_TOKEN` is automatically available; `id-token: write` enables OIDC for npm
- `playwright-report/` directory uploaded as artifact on non-cancelled runs

## Input Dependencies

- Task 1 must complete first (package.json needs correct name `@e0ipso/self-review` and `private: true` removed for the release job to publish successfully)

## Output Artifacts

- New file: `.github/workflows/ci.yml`
- Modified file: `playwright.config.ts` (CI-conditional timeout)

## Implementation Notes

<details>

### Directory setup

Create `.github/workflows/` directory if it doesn't exist.

### playwright.config.ts change

In `/workspace/playwright.config.ts`, change the timeout line from:
```ts
timeout: 30_000,
```
to:
```ts
timeout: process.env.CI ? 60_000 : 30_000,
```

This uses the `CI` environment variable that GitHub Actions automatically sets to `"true"`.

### ci.yml structure

Create `/workspace/.github/workflows/ci.yml` with the following structure:

```yaml
# GitHub Actions CI/CD Pipeline for self-review
#
# This workflow runs three parallel test jobs (Lint, Unit Tests, E2E Tests) on every
# push to main and every PR targeting main. A fourth Release job runs only on main
# pushes after all tests pass.
#
# IMPORTANT: The E2E job disables AppArmor's unprivileged user namespace restriction
# (kernel.apparmor_restrict_unprivileged_userns) because Ubuntu 24.04 enables it by
# default, which prevents Electron/Chromium from launching. This is a known issue:
# https://github.com/electron/electron/issues/41066

name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# Cancel in-progress runs for the same branch/PR
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  unit-test:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit:run

  e2e-test:
    name: E2E Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      # Ubuntu 24.04 restricts unprivileged user namespaces via AppArmor,
      # which breaks Electron/Chromium. Disable it for the test run.
      - name: Disable AppArmor unprivileged userns restriction
        run: sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0

      - run: npm ci

      # Cache the Electron binary (~180MB) to speed up subsequent runs
      - name: Cache Electron binary
        uses: actions/cache@v4
        with:
          path: ~/.cache/electron
          key: electron-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
          restore-keys: |
            electron-${{ runner.os }}-

      - name: Package Electron app
        run: npm run package

      - name: Generate BDD test files
        run: npx bddgen

      - name: Run E2E tests
        run: xvfb-run --auto-servernum npx playwright test

      - name: Upload Playwright report
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14

  release:
    name: Release
    runs-on: ubuntu-latest
    # Only release on pushes to main, after all tests pass
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: [lint, unit-test, e2e-test]
    permissions:
      contents: write      # Create GitHub Releases and tags
      issues: write        # Comment on issues referenced in commits
      pull-requests: write # Comment on PRs referenced in commits
      id-token: write      # npm Trusted Publishing (OIDC)
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # Full history needed for semantic-release commit analysis

      # Node 24 ships npm >=11.5.1 which supports OIDC Trusted Publishing.
      # All other jobs use Node 22 (LTS).
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'npm'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci

      # npm Trusted Publishing (OIDC) setup — one-time manual steps on npmjs.com:
      # 1. Create/claim the @e0ipso/self-review package on npm
      # 2. Go to package Settings → Trusted Publishers → GitHub Actions
      # 3. Configure: repository owner, repository name, workflow filename (ci.yml)
      # 4. The id-token: write permission above enables OIDC token generation
      #
      # Fallback: If OIDC is incompatible with @semantic-release/npm, add an
      # NPM_TOKEN repository secret and set env: NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
      - name: Run semantic-release
        run: npx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Key design decisions

1. **Concurrency group**: Cancels in-progress runs when a new push arrives to the same branch. Saves runner minutes on rapid pushes.

2. **npm ci** (not `npm install`): Clean install from lockfile. Faster and deterministic.

3. **Electron cache placed after npm ci**: The `npm ci` step downloads Electron into `~/.cache/electron`. Caching this path with `actions/cache` avoids the download on subsequent runs. The cache step is placed after `npm ci` so the first run populates the cache, and subsequent runs restore it before `npm ci` (cache restore happens at the step position, but npm ci will skip downloading if the binary exists).

   Actually, **important correction**: The cache restore step should be placed **before** `npm ci` so the cached Electron binary is available when npm ci runs postinstall scripts. Move the cache step to before `npm ci`.

4. **Node 24 for release only**: Minimizes blast radius. Test jobs use the project's target Node version (22).

5. **No `npx playwright install`**: The project uses its own Electron binary via `_electron.launch()`, not Playwright's bundled browsers.

6. **Artifact retention**: 14 days is sufficient for debugging test failures.

**IMPORTANT CORRECTION for the YAML above**: Reorder the E2E job steps so the Electron cache restore comes BEFORE `npm ci`:

```yaml
      - name: Disable AppArmor unprivileged userns restriction
        run: sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0

      - name: Cache Electron binary
        uses: actions/cache@v4
        with:
          path: ~/.cache/electron
          key: electron-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
          restore-keys: |
            electron-${{ runner.os }}-

      - run: npm ci

      - name: Package Electron app
        run: npm run package
```

This ensures the Electron binary cache is restored before `npm ci` runs the electron postinstall script that downloads the binary.

</details>
