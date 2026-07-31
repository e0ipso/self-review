---
id: 4
group: "validation"
dependencies: [1, 2, 3]
status: "completed"
created: "2026-02-12"
skills:
  - e2e-testing
---

# Validate All Tests Pass

## Objective

Run the full unit and e2e test suites to confirm all 76 e2e tests and all 160 unit tests pass after applying the source code and test fixes from tasks 1-3.

## Skills Required

Test execution and failure triage.

## Acceptance Criteria

- [ ] All unit tests pass: `npm run test:unit`
- [ ] All 76 e2e tests pass: `npm run test:e2e`
- [ ] No test assertions were weakened or skipped

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Host machine with display server (e2e tests cannot run in dev container)
- `npm run package` must be run before e2e tests if the build is stale

## Input Dependencies

- Task 1: Source code fixes applied (comment icon + badge class)
- Task 2: Test assertion fixes applied (color regex, diff stats, XML count)
- Task 3: Test selector and Feature 10 fixes applied

## Output Artifacts

- Test execution results confirming all pass
- If any failures remain, document them with error output for further triage

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Step 1: Check Environment

First verify you are NOT inside the dev container:

```bash
# If this file exists, you're in the dev container — e2e tests won't work
test -f /.dockerenv && echo "IN CONTAINER" || echo "ON HOST"
```

### Step 2: Run Unit Tests

```bash
npm run test:unit
```

All ~160 unit tests should pass. If any fail, the source code fixes from Task 1 may have introduced a regression — investigate before proceeding.

### Step 3: Build the App

```bash
npm run package
```

This is required before e2e tests. The `package` script runs `clean` first.

### Step 4: Run E2E Tests

```bash
npm run test:e2e
```

Expected: all 76 tests pass.

### Step 5: Triage Any Remaining Failures

If tests still fail:
1. Check the error output carefully
2. Compare against the plan's failure log excerpts
3. Document the exact failure with error message, locator, and expected/received values
4. If the failure is in a category addressed by tasks 1-3, verify those fixes were applied correctly
5. If the failure is a new/different issue, document it as a new finding

</details>
