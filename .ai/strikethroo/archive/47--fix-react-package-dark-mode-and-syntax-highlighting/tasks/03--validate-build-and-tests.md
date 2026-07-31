---
id: 3
group: "validation"
dependencies: [1, 2]
status: "completed"
created: "2026-03-16"
skills:
  - bash
---
# Validate Build Output and Run Tests

## Objective
Run the full build and test suite to verify that both fixes (Prism static imports + CSS bundling) work correctly together, and that the build output meets all success criteria from the plan.

## Skills Required
- Bash (running build commands, grepping output, interpreting results)

## Acceptance Criteria
- [ ] `npm run build` in `packages/react` completes without errors
- [ ] `grep -c '\.token' packages/react/dist/styles.css` returns > 50
- [ ] `grep -c 'wmde-markdown\|data-color-mode' packages/react/dist/styles.css` returns > 0
- [ ] `grep -c 'loadPrism' packages/react/dist/index.js` returns 0
- [ ] Prism `.token` selectors in `dist/styles.css` are scoped under `.self-review` (not global)
- [ ] `npm run test:unit` from project root passes all tests
- [ ] No regressions in existing functionality

## Technical Requirements
- Node.js, npm workspaces
- Access to `packages/react/` build scripts
- Vitest for unit tests

## Input Dependencies
- Task 1: Consolidated Prism static imports in SyntaxLine.tsx
- Task 2: Bundled CSS dependencies in build-styles.css

## Output Artifacts
- Verified build output confirming all success criteria are met
- Passing test suite

## Implementation Notes

<details>
<summary>Detailed validation steps</summary>

### Step 1: Build the package
```bash
cd packages/react && npm run build
```
Verify it completes with exit code 0.

### Step 2: Check CSS output for Prism tokens
```bash
grep -c '\.token' packages/react/dist/styles.css
```
Expected: a count > 50 (Prism theme rules generate many `.token` selectors).

### Step 3: Check CSS output for md-editor styles
```bash
grep -c 'wmde-markdown\|data-color-mode' packages/react/dist/styles.css
```
Expected: a count > 0.

### Step 4: Verify loadPrism is removed from JS bundle
```bash
grep -c 'loadPrism' packages/react/dist/index.js
```
Expected: 0.

### Step 5: Verify Prism CSS is scoped
```bash
grep -B2 '\.token' packages/react/dist/styles.css | head -20
```
Verify that `.token` selectors appear inside `.self-review` or `.self-review.dark` / `.self-review:not(.dark)` blocks, not at the global scope.

### Step 6: Run unit tests
```bash
npm run test:unit
```
All tests must pass. If any SyntaxLine-related tests fail, they likely need updating to account for the removal of async Prism loading (the component now renders highlighted output synchronously).

### Step 7: Fix any test failures
If tests reference `loadPrism`, `prismInstance`, or test async rendering behavior of SyntaxLine, update them to reflect the new synchronous behavior.

</details>
