---
id: 2
group: "renderer-layout"
dependencies: [1]
status: "completed"
created: 2026-04-29
skills:
  - playwright
  - e2e-testing
---

# Add webapp e2e regression test for toolbar pinning

## Objective

Lock in the "toolbar stays anchored at the top of the window even when the diff pane is scrolled" contract via the existing webapp e2e harness so future layout regressions are caught in CI.

## Skills Required

- `playwright` — bounding box assertions, programmatic scrolling.
- `e2e-testing` — Cucumber `.feature` + step-definition file authoring under `tests/webapp-features/` and `tests/webapp-steps/`.

## Acceptance Criteria

- [ ] A new scenario exists in `tests/webapp-features/05-view-modes-and-toolbar.feature` (or a dedicated new feature file `tests/webapp-features/09-toolbar-pinning.feature`) that:
  - loads the webapp with a fixture containing multiple expanded files,
  - scrolls the diff scroll container `[data-scroll-container="diff"]` to its bottom,
  - asserts that `[data-testid='toolbar']` is visible and its bounding box `y` is `0` (or the bottom edge of `[data-testid='update-banner']` if rendered),
  - asserts that `document.body.scrollTop === 0` and `document.documentElement.scrollTop === 0`.
- [ ] Step definitions are added to a matching steps file (`tests/webapp-steps/...steps.ts`) using `playwright-bdd`'s `createBdd`.
- [ ] `npm run test:e2e` passes with the new scenario green.
- [ ] No fixture data is removed; if a new fixture is added, it lives in `tests/webapp/fixture-data.ts` next to the existing ones.
- [ ] No changes outside `tests/` are needed; the harness already exposes the necessary `data-testid` attributes once task 1 has been applied.

## Technical Requirements

- BDD framework: `@cucumber/cucumber` + `playwright-bdd` (`createBdd`).
- Test runner: Playwright via `npx bddgen && npx playwright test --project e2e`.
- Page object helper: `getPage()` from `tests/webapp-steps/app.ts`.
- The toolbar is rendered with `data-testid='toolbar'` (already present in `packages/react/src/components/Toolbar.tsx`).
- The diff scroll container is `[data-scroll-container="diff"]` (set by the diff panel inside `Layout`).

## Input Dependencies

- Task 1 must complete first: the layout fix is a precondition for the assertion (without `shrink-0` and `min-h-0`, the test would be a flaky reproducer). The e2e suite assumes the fix is in place.

## Output Artifacts

- New `.feature` scenario and matching step definitions.
- A passing CI run for `npm run test:e2e`.

## Implementation Notes

<details>

### Where to put the test

Option A (preferred, minimal): append a single scenario to the existing `tests/webapp-features/05-view-modes-and-toolbar.feature`, since the toolbar already lives in this feature's domain. Add the matching step definitions to `tests/webapp-steps/05-view-modes-and-toolbar.steps.ts`.

Option B (acceptable): create `tests/webapp-features/09-toolbar-pinning.feature` and `tests/webapp-steps/09-toolbar-pinning.steps.ts` if you want a dedicated home. Pick whichever keeps diff size smallest; do not duplicate existing steps.

### Suggested scenario

```gherkin
Scenario: Toolbar stays pinned when the diff pane scrolls
  Given the webapp is loaded with fixture data
  When I expand all file sections via the toolbar
  And I scroll the diff pane to the bottom
  Then the toolbar should remain anchored at the top of the viewport
  And the document itself should not have scrolled
```

The "Given the webapp is loaded with fixture data" step already exists (it is the `Background` for feature 05). Reuse it.

### Suggested step implementations (Playwright)

```ts
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { getPage } from './app';

const { When, Then } = createBdd();

When('I expand all file sections via the toolbar', async () => {
  const page = getPage();
  // Ensure they are expanded — clicking "Expand all" is idempotent.
  await page.locator('[data-testid="expand-all-btn"]').click();
});

When('I scroll the diff pane to the bottom', async () => {
  const page = getPage();
  const container = page.locator('[data-scroll-container="diff"]');
  await container.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
});

Then('the toolbar should remain anchored at the top of the viewport', async () => {
  const page = getPage();
  const toolbar = page.locator('[data-testid="toolbar"]');
  await expect(toolbar).toBeVisible();
  const box = await toolbar.boundingBox();
  expect(box).not.toBeNull();
  // No UpdateBanner in webapp harness, so toolbar.top should equal 0.
  // Allow up to 1px subpixel tolerance.
  expect(box!.y).toBeLessThanOrEqual(1);
});

Then('the document itself should not have scrolled', async () => {
  const page = getPage();
  const scroll = await page.evaluate(() => ({
    body: document.body.scrollTop,
    html: document.documentElement.scrollTop,
  }));
  expect(scroll.body).toBe(0);
  expect(scroll.html).toBe(0);
});
```

If any of these step phrases collide with an existing step, rename the new ones (Cucumber matches on the literal phrase) or reuse the existing step verbatim — do not declare two steps with the same regex.

### Why this passes only after task 1

Without `shrink-0` on `Toolbar` (and `min-h-0` discipline upstream), scrolling a tall expanded diff in the webapp harness can either compress the toolbar's height or, in the Electron renderer, push it beyond the viewport top. The `box.y` assertion is the smallest possible regression sentinel for that class of bugs.

### Validation

- `npm run test:e2e` (this is the webapp e2e suite — fast, runs in CI). It works inside the dev container too as long as Playwright browsers are installed; if browsers are missing, run `npx playwright install` once.
- Do **not** run `npm run test:e2e:electron` — `AGENTS.md` says the Electron e2e suite cannot run in the dev container.
- After tests pass, stage only the changed `tests/` files and create a single conventional-commits commit, e.g. `test(e2e): add regression test for pinned toolbar`. Do not amend the commit from task 1.

</details>
