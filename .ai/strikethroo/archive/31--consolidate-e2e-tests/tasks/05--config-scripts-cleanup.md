---
id: 5
group: "configuration"
dependencies: [3, 4]
status: "completed"
created: "2026-03-05"
skills:
  - playwright
  - typescript
---
# Playwright Config Rename, Package Scripts, and Electron Cleanup

## Objective
Rename Playwright projects (`e2e` → `electron`, `webapp` → `e2e`), update package.json scripts, and delete duplicated/ported Electron feature and step files.

## Skills Required
- playwright (Playwright project configuration)
- typescript (package.json scripts)

## Acceptance Criteria
- [ ] `playwright.config.ts`: project `"e2e"` now runs webapp tests, `"electron"` runs Electron tests
- [ ] `defineBddConfig` output directories are explicit and non-conflicting
- [ ] `package.json` scripts updated: `test:e2e` runs webapp, `test:e2e:electron` runs Electron, `test:e2e:webapp` removed
- [ ] Electron features 01-06, 10, 13 deleted (8 feature files + 8 step files = 16 files)
- [ ] `npx bddgen` generates test files for both projects without errors
- [ ] Remaining Electron features (07-09, 11-12, 14) are structurally intact

## Technical Requirements
- In `playwright.config.ts`:
  - Rename project `"e2e"` to `"electron"`, keeping its testDir pointing to Electron BDD output
  - Rename project `"webapp"` to `"e2e"`, keeping its testDir pointing to webapp BDD output
  - Set explicit `outputDir` for both `defineBddConfig` calls
- In `package.json`:
  - `test:e2e`: `npx bddgen && npx playwright test --project e2e`
  - `test:e2e:headed`: `npx bddgen && npx playwright test --project e2e --headed`
  - `test:e2e:electron`: `npm run package && npx bddgen && xvfb-run --auto-servernum npx playwright test --project electron`
  - `test:e2e:electron:headed`: `npm run package && npx bddgen && npx playwright test --project electron --headed`
  - Remove `test:e2e:webapp`

## Input Dependencies
- Tasks 3, 4: New webapp features 07, 08 must exist before validating the config works

## Output Artifacts
- Updated `playwright.config.ts`
- Updated `package.json`
- Deleted: `tests/features/01-06, 10, 13` and `tests/steps/01-06, 10, 13`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### playwright.config.ts

Find the two `defineBddConfig` calls and the project definitions. Current state:
- `bddTestDir` = BDD output for Electron features
- `webappBddTestDir` = BDD output for webapp features

Rename projects:
```typescript
// Before
{ name: 'e2e', testDir: bddTestDir, ... }
{ name: 'webapp', testDir: webappBddTestDir, ... }

// After
{ name: 'electron', testDir: bddTestDir, ... }
{ name: 'e2e', testDir: webappBddTestDir, ... }
```

Set explicit `outputDir` in `defineBddConfig`:
```typescript
const bddTestDir = defineBddConfig({
  featuresRoot: './tests/features/',
  stepsRoot: './tests/steps/',
  outputDir: '.features-gen/electron',
});

const webappBddTestDir = defineBddConfig({
  featuresRoot: './tests/webapp-features/',
  stepsRoot: './tests/webapp-steps/',
  outputDir: '.features-gen/webapp',
});
```

### Files to delete

Features:
- `tests/features/01-launch-and-display.feature`
- `tests/features/02-file-tree-navigation.feature`
- `tests/features/03-commenting.feature`
- `tests/features/04-suggestions.feature`
- `tests/features/05-view-modes-and-toolbar.feature`
- `tests/features/06-viewed-status.feature`
- `tests/features/10-empty-diff-help.feature`
- `tests/features/13-rendered-markdown.feature`

Steps:
- `tests/steps/01-launch-and-display.steps.ts`
- `tests/steps/02-file-tree-navigation.steps.ts`
- `tests/steps/03-commenting.steps.ts`
- `tests/steps/04-suggestions.steps.ts`
- `tests/steps/05-view-modes-and-toolbar.steps.ts`
- `tests/steps/06-viewed-status.steps.ts`
- `tests/steps/10-empty-diff-help.steps.ts`
- `tests/steps/13-rendered-markdown.steps.ts`

Before deleting, verify no imports from these files exist in remaining Electron steps (07-09, 11-12, 14). The plan states this was already verified.

### package.json scripts

Replace the scripts section entries as specified. Key change: `test:e2e` no longer needs `npm run package` or `xvfb-run`.

</details>
