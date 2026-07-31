---
id: 2
group: "test-fixes"
dependencies: []
status: "completed"
created: "2026-02-12"
skills:
  - playwright
---

# Fix E2E Test Assertions for Display Styling, Diff Stats, and XML Output

## Objective

Correct hardcoded e2e test assertions that don't match the actual application output: a CSS color class regex, diff stats numbers, and an XML file element count.

## Skills Required

Playwright e2e test patterns — updating assertion values in feature files and step definitions.

## Acceptance Criteria

- [ ] Color assertion in Feature 01 uses `/bg-emerald/` instead of `/bg-green/`
- [ ] Diff stats assertions in Feature 05 use `"+49"` and `"-51"` instead of `"+37"` and `"-44"`
- [ ] XML file element count in Feature 07 uses `4` instead of `2`

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Playwright test assertion syntax
- Understanding of the test fixture output (4 files, +49/-51)

## Input Dependencies

None — these are test-only fixes independent of source code changes.

## Output Artifacts

- Modified `tests/steps/01-launch-and-display.steps.ts`
- Modified `tests/features/05-view-modes-and-toolbar.feature`
- Modified `tests/features/07-xml-output.feature`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Fix 1: Color Class Regex

**Problem**: The source uses `bg-emerald-50/70` (emerald Tailwind palette) for additions but the test asserts `/bg-green/`.

**File**: `tests/steps/01-launch-and-display.steps.ts` line 200

```typescript
// BEFORE:
await expect(additionLine).toHaveClass(/bg-green/);

// AFTER:
await expect(additionLine).toHaveClass(/bg-emerald/);
```

### Fix 2: Diff Stats Assertions

**Problem**: The `createTestRepo()` function always produces 4 files with +49/-51 stats. The feature file has incorrect values.

**File**: `tests/features/05-view-modes-and-toolbar.feature` lines 44-45

```gherkin
# BEFORE:
    And the toolbar should show additions count "+37"
    And the toolbar should show deletions count "-44"

# AFTER:
    And the toolbar should show additions count "+49"
    And the toolbar should show deletions count "-51"
```

Line 43 (`Then the toolbar should show "4 files changed"`) is already correct.

### Fix 3: XML File Element Count

**Problem**: The test fixture creates 4 files but the "Empty review" scenario in Feature 07 asserts only 2 file elements.

**File**: `tests/features/07-xml-output.feature` line 21

```gherkin
# BEFORE:
    And the XML should contain 2 file elements

# AFTER:
    And the XML should contain 4 file elements
```

### Verification

These fixes can be partially verified by reviewing that the assertion values match the documented fixture output:
```
README.md         (+3/-1)
src/auth/login.ts (+21/-10)
src/config.ts     (+25/-0)
src/legacy.ts     (+0/-40)
4 files changed, 49 insertions(+), 51 deletions(-)
```

</details>
