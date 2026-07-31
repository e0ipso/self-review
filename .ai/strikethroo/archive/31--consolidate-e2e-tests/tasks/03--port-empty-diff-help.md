---
id: 3
group: "feature-porting"
dependencies: [1, 2]
status: "completed"
created: "2026-03-05"
skills:
  - playwright
  - e2e-testing
---
# Port Feature 10 (Empty Diff Help) to Webapp Suite

## Objective
Create webapp feature file `tests/webapp-features/07-empty-diff-help.feature` and step file `tests/webapp-steps/07-empty-diff-help.steps.ts`, porting 5 of 6 scenarios from Electron's feature 10. The "Valid XML on close" scenario is excluded (requires file I/O + process exit).

## Skills Required
- playwright (Playwright selectors and assertions)
- e2e-testing (BDD feature/step structure)

## Acceptance Criteria
- [ ] `tests/webapp-features/07-empty-diff-help.feature` has 5 scenarios matching the Electron originals
- [ ] `tests/webapp-steps/07-empty-diff-help.steps.ts` implements all Given/When/Then steps
- [ ] Given steps call `launchWebapp({ fixture: 'empty' })` (or `{ fixture: 'empty', gitDiffArgs: '...' }` for the arguments scenario)
- [ ] Then steps use same `data-testid` selectors as Electron: `empty-diff-help`, `file-tree`, `file-section-*`
- [ ] All 5 scenarios pass with `npx bddgen && npx playwright test --project webapp`

## Technical Requirements
- Use `playwright-bdd` `Given`, `When`, `Then` from `tests/webapp-steps/fixtures` or create fixtures
- Import `launchWebapp`, `cleanupAll` from `./app`
- Follow existing webapp step file patterns (see `tests/webapp-steps/01-launch-and-display.steps.ts`)

## Input Dependencies
- Task 1: `createEmptyPayload()` in fixture-data.ts, `?fixture=empty` routing in main.tsx
- Task 2: `launchWebapp()` conditional wait for empty fixture

## Output Artifacts
- `tests/webapp-features/07-empty-diff-help.feature`
- `tests/webapp-steps/07-empty-diff-help.steps.ts`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Feature file (`07-empty-diff-help.feature`)

Port these 5 scenarios from `tests/features/10-empty-diff-help.feature`:

1. **Help message displayed** — Given empty diff → Then `[data-testid="empty-diff-help"]` visible
2. **Common usage examples** — Given empty diff → Then help message contains command/description table entries
3. **Arguments shown** — Given empty diff with `gitDiffArgs=--staged` → Then help shows `--staged`
4. **Not displayed when files exist** — Given default fixture (no `?fixture` param) → Then no `empty-diff-help` element
5. **File tree empty state** — Given empty diff → Then file tree shows "No files" message, file count badge shows 0

Replace the Electron "Given a git repository" steps with webapp-style Given steps that call `launchWebapp()`.

### Step file (`07-empty-diff-help.steps.ts`)

Pattern to follow from existing webapp steps:

```typescript
import { Given, Then } from './fixtures';
import { launchWebapp, cleanupAll, getPage } from './app';

Given('an empty diff', async () => {
  await launchWebapp({ fixture: 'empty' });
});

Given('an empty diff with arguments {string}', async ({}, args: string) => {
  await launchWebapp({ fixture: 'empty', gitDiffArgs: args });
});

Given('a diff with files', async () => {
  await launchWebapp();  // default fixture has files
});
```

Then steps mirror the Electron steps' selectors exactly since both target the same React components.

Check `tests/webapp-steps/01-launch-and-display.steps.ts` for the exact pattern of how Given/Then steps are structured and how fixtures are imported.

### After steps call `AfterAll` from the fixtures to clean up:

```typescript
import { AfterAll } from './fixtures';
AfterAll(async () => { await cleanupAll(); });
```

</details>
