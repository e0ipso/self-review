---
id: 2
group: "tree-shaking"
dependencies: [1]
status: "completed"
created: "2026-03-11"
skills: ["tsup", "bash"]
---
# Verify tree-shaking build output

## Objective
Rebuild `@self-review/react` with the new tsup configuration and confirm: the build succeeds, `dist/index.js` has not grown in size, all unit tests pass, and dead-code elimination is observable in the dist artifact.

## Skills Required
- bash / CLI tooling
- tsup build verification

## Acceptance Criteria
- [ ] `npm run build` in `packages/react` exits with code 0, no errors or warnings
- [ ] New `dist/index.js` size is ≤ the pre-change size (record both via `wc -c`)
- [ ] `npm run test:unit` in `packages/react` passes with no failures
- [ ] `grep -c "SingleFileReview" packages/react/dist/index.js` returns a lower count than before the change (ideally 0), confirming dead-code elimination at build time

## Technical Requirements
- Run all verification commands from the repo root or `packages/react` directory as appropriate.
- If `dist/index.js` does not exist before the build (clean state), run the build once before recording the baseline (or note the pre-change size is unknown and proceed with post-change validation only).
- If the size has increased, investigate whether `splitting: true` introduced overhead. If so, remove `splitting: true` from tsup.config.ts and rebuild — `treeshake: true` alone is sufficient per the plan.

## Input Dependencies
- Task 1: Modified `packages/react/tsup.config.ts` and `packages/react/package.json`

## Output Artifacts
None (verification only). If size regression is found and `splitting` is dropped, the modified `tsup.config.ts` is updated in place.

## Implementation Notes

<details>
<summary>Step-by-step verification commands</summary>

### 1. Record baseline size (if dist exists)
```bash
wc -c packages/react/dist/index.js
grep -c "SingleFileReview" packages/react/dist/index.js
```

### 2. Build
```bash
cd packages/react && npm run build
```
or from repo root:
```bash
npm run build --workspace=packages/react
```

### 3. Record new size and compare
```bash
wc -c packages/react/dist/index.js
grep -c "SingleFileReview" packages/react/dist/index.js
```
The new size must be ≤ baseline. The `SingleFileReview` grep count must be lower (ideally 0).

### 4. Run unit tests
```bash
cd packages/react && npm run test:unit
```
All tests must pass.

### 5. Size regression fallback
If `dist/index.js` grew after enabling both options, remove `splitting: true` from `packages/react/tsup.config.ts` (keep `treeshake: true`), rebuild, and re-verify. Document the outcome.

</details>
