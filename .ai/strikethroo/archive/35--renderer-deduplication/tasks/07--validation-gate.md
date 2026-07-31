---
id: 7
group: "validation"
dependencies: [6]
status: "pending"
created: "2026-03-11"
skills:
  - "typescript"
---
# Validation Gate

## Objective
Run all required validation checks to confirm the deduplication is complete, correct, and no regressions were introduced. This is the final task and must pass before the plan is considered done.

## Skills Required
- TypeScript (reading test output, fixing issues)

## Acceptance Criteria
- [ ] `npm run test:unit` passes (root unit tests)
- [ ] `npm run --workspace @self-review/react test:unit` passes (package unit tests)
- [ ] `rg "review:request|onRequestReview" src/renderer packages/react/src` returns no matches
- [ ] `rg "window\\.electronAPI" packages/react/src` returns no matches
- [ ] `npm run package` succeeds (webpack bundle compiles without errors)
- [ ] `tsc --noEmit` passes

## Technical Requirements
- All validation commands must be run in sequence; any failure must be diagnosed and fixed (do not skip)
- If tests fail, fix the root cause before marking complete — do not add test workarounds

## Input Dependencies
- Task 06: all renderer duplicates removed and imports updated

## Output Artifacts
- Passing test runs (no artifacts to write — validation is the output)

## Implementation Notes

<details>
<summary>Validation sequence</summary>

Run these commands in order. Fix any failures before proceeding to the next step:

```bash
# 1. Type-check
tsc --noEmit

# 2. Root unit tests
npm run test:unit

# 3. Package unit tests
npm run --workspace @self-review/react test:unit

# 4. Constraint checks (must return empty)
rg "review:request|onRequestReview" src/renderer packages/react/src
rg "window\\.electronAPI" packages/react/src

# 5. Bundle validation
npm run package
```

If `npm run package` fails with a module resolution error, trace back to resolver alignment (task 02) and fix the webpack/tsconfig config.

If unit tests fail after deduplication, the root cause is likely a missing import update or a deleted file that was not fully replaced. Read the error carefully and fix the import.

**Do not mark this task complete until all 6 checks pass.**
</details>
