---
id: 3
group: "test-fixes"
dependencies: []
status: "completed"
created: "2026-02-12"
skills:
  - playwright
---

# Fix E2E Comment Display Selectors and Feature 10 Assertions

## Objective

Fix two categories of e2e test bugs: (1) the comment display selector in Feature 03 falsely matches comment icon buttons, and (2) Feature 10 assertions for file count and empty state don't match actual behavior.

## Skills Required

Playwright selector specificity and Cucumber BDD step definitions.

## Acceptance Criteria

- [ ] Comment display selector in `03-commenting.steps.ts` excludes `comment-icon-*` and `comment-collapse-*` elements
- [ ] Comment display selector in `08-resume.steps.ts` similarly updated
- [ ] Feature 10 "has files" scenario asserts 4 file sections (matching actual fixture)
- [ ] Feature 10 "empty state" scenario correctly checks for "No files in diff" text

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Playwright locator selector syntax
- Cucumber BDD step definition patterns
- Understanding of the `data-testid` naming conventions in the app

## Input Dependencies

None — these are test-only fixes independent of source code changes.

## Output Artifacts

- Modified `tests/steps/03-commenting.steps.ts`
- Modified `tests/steps/08-resume.steps.ts`
- Modified `tests/features/10-empty-diff-help.feature`
- Possibly modified `tests/steps/10-empty-diff-help.steps.ts`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Fix 1: Comment Display Selector

**Problem**: The selector `[data-testid^="comment-"]:not([data-testid="comment-input"])` in `03-commenting.steps.ts` matches both `comment-{uuid}` (actual displayed comments) and `comment-icon-*` (gutter icon buttons). When no actual comments exist, the selector finds icon buttons, causing false positives.

**File**: `tests/steps/03-commenting.steps.ts`

There are ~15 occurrences of this selector pattern in the file. All instances need the same update. Perform a global find-and-replace:

```typescript
// BEFORE (two variants):
'[data-testid^="comment-"]:not([data-testid="comment-input"])'
'[data-testid^="comment-"]'  // (the one at line 491 without the :not)

// AFTER:
'[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
'[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid^="comment-collapse"])'
```

Key occurrences to update (all in `03-commenting.steps.ts`):
- Lines 338, 469, 480, 499, 508, 519, 529, 558, 580, 590, 623, 636, 647, 659, 670: add `:not([data-testid^="comment-icon"]):not([data-testid^="comment-collapse"])` exclusions
- Line 491 (inside a file section scope): add `:not([data-testid^="comment-icon"]):not([data-testid^="comment-collapse"])`

**File**: `tests/steps/08-resume.steps.ts` line 56

```typescript
// BEFORE:
const comments = page.locator('[data-testid^="comment-"]');

// AFTER:
const comments = page.locator('[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid^="comment-collapse"])');
```

### Fix 2: Feature 10 File Count

**Problem**: The "has files" scenario expects 1 file section but `createTestRepo()` always produces 4 files.

**File**: `tests/features/10-empty-diff-help.feature` line 35

```gherkin
# BEFORE:
    And the diff viewer should show 1 file section

# AFTER:
    And the diff viewer should show 4 file sections
```

Note: The step definition at `10-empty-diff-help.steps.ts:87` uses `{int}` parameter so it handles any count. However, check if the step pattern uses "section" (singular) or "sections" (plural) — if the existing Cucumber step definition only matches singular "section", you may need to update it to handle both, e.g., `'the diff viewer should show {int} file section(s)'` or add a second step.

### Fix 3: Feature 10 Empty State

**Problem**: `Then the file tree should show "No files in diff"` uses a step from `02-file-tree-navigation.steps.ts:64` which looks for `[data-testid="file-entry-No files in diff"]`. But the empty state in `FileTree.tsx:220-223` renders a plain `<div>` with text, not a file entry.

The step definition at `02-file-tree-navigation.steps.ts:64`:
```typescript
Then('the file tree should show {string}', async ({}, filePath: string) => {
  const page = getPage();
  const entry = page.locator(`[data-testid="file-entry-${filePath}"]`);
  await expect(entry).toBeVisible();
});
```

**Solution**: Add a new, more specific step definition in `10-empty-diff-help.steps.ts` that checks for text content within the file tree panel:

```typescript
Then('the file tree should show {string}', async ({}, text: string) => {
  const page = getPage();
  const fileTree = page.locator('[data-testid="file-tree"]');
  await expect(fileTree).toContainText(text);
});
```

**IMPORTANT**: This will conflict with the existing step in `02-file-tree-navigation.steps.ts` since Cucumber/playwright-bdd doesn't allow duplicate step patterns. Instead, change the feature file to use a unique phrasing:

**File**: `tests/features/10-empty-diff-help.feature` line 40

```gherkin
# BEFORE:
    Then the file tree should show "No files in diff"

# AFTER:
    Then the file tree should display the message "No files in diff"
```

Then add this step to `tests/steps/10-empty-diff-help.steps.ts`:

```typescript
Then(
  'the file tree should display the message {string}',
  async ({}, text: string) => {
    const page = getPage();
    const fileTree = page.locator('[data-testid="file-tree"]');
    await expect(fileTree).toContainText(text);
  }
);
```

</details>
