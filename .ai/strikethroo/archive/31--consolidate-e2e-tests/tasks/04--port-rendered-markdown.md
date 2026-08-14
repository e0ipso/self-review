---
id: 4
group: "feature-porting"
dependencies: [1, 2]
status: "completed"
created: "2026-03-05"
skills:
  - playwright
  - e2e-testing
---
# Port Feature 13 (Rendered Markdown) to Webapp Suite

## Objective
Create webapp feature file `tests/webapp-features/08-rendered-markdown.feature` and step file `tests/webapp-steps/08-rendered-markdown.steps.ts`, porting all 8 scenarios from Electron's feature 13.

## Skills Required
- playwright (Playwright selectors, assertions, timeouts)
- e2e-testing (BDD feature/step structure)

## Acceptance Criteria
- [ ] `tests/webapp-features/08-rendered-markdown.feature` has 8 scenarios matching the Electron originals
- [ ] `tests/webapp-steps/08-rendered-markdown.steps.ts` implements all Given/When/Then steps
- [ ] Given steps call `launchWebapp({ fixture: 'markdown' })`
- [ ] When/Then steps use same selectors as Electron: `[aria-label="Rendered view"]`, `.rendered-markdown-view`, `.rendered-gutter`, `.rendered-block`
- [ ] Mermaid SVG test uses 10-second timeout
- [ ] All 8 scenarios pass with `npx bddgen && npx playwright test --project webapp`

## Technical Requirements
- Use `playwright-bdd` Given/When/Then
- Import `launchWebapp`, `cleanupAll`, `getPage` from `./app`
- Follow existing webapp step file patterns
- The markdown fixture (`docs/new-docs.md`) from task 1 must have content that produces the expected rendered output

## Input Dependencies
- Task 1: `createMarkdownPayload()` in fixture-data.ts, `?fixture=markdown` routing in main.tsx
- Task 2: `launchWebapp()` works correctly (uses default file-entry wait for markdown fixture)

## Output Artifacts
- `tests/webapp-features/08-rendered-markdown.feature`
- `tests/webapp-steps/08-rendered-markdown.steps.ts`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Feature file (`08-rendered-markdown.feature`)

Port all 8 scenarios from `tests/features/13-rendered-markdown.feature`:

1. **New .md shows rendered toggle** — `docs/new-docs.md` header has `[aria-label="Rendered view"]`
2. **Non-.md no toggle** — `src/index.ts` header does NOT have the toggle
3. **Modified .md no toggle** — `README.md` (modified) does NOT have the toggle
4. **Toggle switches view** — Click toggle → `.rendered-markdown-view` visible with h1, h2, h3, p, ul, ol, pre
5. **Gutter line ranges** — `.rendered-gutter` elements contain `/^\d+(-\d+)?$/`, one shows "3-4"
6. **Comment on rendered block** — Click `.rendered-gutter` on `p.rendered-block` → comment input opens
7. **Comments persist across toggle** — Add comment in rendered view → switch to raw → comment still visible
8. **Mermaid SVG** — `.rendered-markdown-view svg` visible (10s timeout)

Replace Electron "Given a git repository with a new markdown file" steps with `launchWebapp({ fixture: 'markdown' })`.

### Step file (`08-rendered-markdown.steps.ts`)

Key differences from Electron steps:
- **Given** steps use `launchWebapp({ fixture: 'markdown' })` instead of creating temp git repos
- **When/Then** steps are nearly identical since they target the same React components
- File references use the fixture filenames: `docs/new-docs.md`, `src/index.ts`, `README.md`

Pattern:

```typescript
Given('a diff with a new markdown file and other files', async () => {
  await launchWebapp({ fixture: 'markdown' });
});

Then('I should see a {string} toggle in the file header for {string}', async ({}, toggleLabel: string, filePath: string) => {
  const page = getPage();
  const header = page.locator(`[data-testid="file-header-${filePath}"]`);
  await expect(header.locator(`[aria-label="${toggleLabel} view"]`)).toBeVisible();
});
```

For the mermaid test, use `{ timeout: 10_000 }` on the SVG assertion.

Check `tests/steps/13-rendered-markdown.steps.ts` for exact selector patterns to replicate.

</details>
