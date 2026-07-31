---
id: 2
group: "test-infrastructure"
dependencies: []
status: "completed"
created: "2026-03-05"
skills:
  - playwright
---
# Webapp Launcher Fix for Empty Fixture

## Objective
Update `launchWebapp()` in `tests/webapp-steps/app.ts` to handle the empty fixture case, which has no file entries and would otherwise timeout waiting for `[data-testid^="file-entry-"]`.

## Skills Required
- playwright (Playwright page interactions and waits)

## Acceptance Criteria
- [ ] When `queryParams.fixture === 'empty'`, `launchWebapp()` waits for `[data-testid="empty-diff-help"]` instead of `[data-testid^="file-entry-"]`
- [ ] Default behavior (no fixture or other fixtures) remains unchanged — still waits for file entries
- [ ] No timeout on empty diff scenarios

## Technical Requirements
- Modify the `launchWebapp()` function in `tests/webapp-steps/app.ts`
- The function already accepts `queryParams: Record<string, string>` parameter
- After navigation, conditionally select the wait selector based on `queryParams.fixture`

## Input Dependencies
None — independent of fixture data changes.

## Output Artifacts
- Updated `tests/webapp-steps/app.ts` with conditional wait logic

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

In `tests/webapp-steps/app.ts`, find the line that waits for file entries (around line 146):

```typescript
await page.waitForSelector('[data-testid^="file-entry-"]');
```

Replace with:

```typescript
if (queryParams.fixture === 'empty') {
  await page.waitForSelector('[data-testid="empty-diff-help"]');
} else {
  await page.waitForSelector('[data-testid^="file-entry-"]');
}
```

This is a minimal, surgical change. The `queryParams` object is already available in scope since it's passed to `launchWebapp()` and used to build the URL.

</details>
