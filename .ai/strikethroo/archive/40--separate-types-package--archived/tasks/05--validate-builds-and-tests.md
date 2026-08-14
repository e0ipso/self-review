---
id: 5
group: types-package
dependencies:
  - 2
  - 3
  - 4
status: completed
created: '2026-03-11'
skills:
  - typescript
---
# Validate Builds and Tests

## Objective
Run `npm install` at workspace root to create workspace symlinks for the new `@self-review/types` package, then build all three packages in dependency order and run the full unit test suite to confirm the refactor is correct.

## Skills Required
TypeScript, npm workspaces, tsup.

## Acceptance Criteria
- [ ] `npm install` at workspace root completes without errors
- [ ] `npm run build` in `packages/types/` exits 0
- [ ] `npm run build` in `packages/core/` exits 0
- [ ] `npm run build` in `packages/react/` exits 0
- [ ] `npm run test:unit` from workspace root — all tests pass
- [ ] `npx tsc --noEmit` in `packages/core/` — zero errors
- [ ] `npx tsc --noEmit` in `packages/react/` — zero errors
- [ ] `ImageLoadResult` is defined exactly once: in `packages/types/src/index.ts` (confirm with grep)

## Technical Requirements
- Packages must be built in order: `types` → `core` → `react` (core depends on types; react depends on types; independent for core vs react but types must come first)
- The `npm install` at root is required for npm workspaces to create the `node_modules/@self-review/types` symlink pointing to `packages/types/`

## Input Dependencies
- Task 02: Core updated to re-export from types
- Task 03: React updated to import from types
- Task 04: Electron app updated to import from types

## Output Artifacts
- Validation report (pass/fail for each check)
- Built `dist/` directories in all three packages

## Implementation Notes

<details>
<summary>Validation commands</summary>

Run in sequence:

```bash
# Step 1: Install to create workspace symlinks
npm install

# Step 2: Build packages in order
npm run build --workspace=packages/types
npm run build --workspace=packages/core
npm run build --workspace=packages/react

# Step 3: Type check
cd packages/core && npx tsc --noEmit && cd ../..
cd packages/react && npx tsc --noEmit && cd ../..

# Step 4: Unit tests
npm run test:unit

# Step 5: Confirm ImageLoadResult is defined exactly once
grep -rn "ImageLoadResult\s*=" packages/ src/
# Should show exactly one definition: in packages/types/src/index.ts
```

If any step fails, diagnose and fix the root cause before marking this task complete.

Common failure modes:
- **Missing external in tsup**: If tsup tries to bundle `@self-review/types` into core or react output, add it to the `external` array.
- **Workspace symlink not found**: Run `npm install` at root again.
- **TypeScript can't resolve `@self-review/types`**: Confirm `packages/types/package.json` has `"main"` and `"types"` fields pointing at `dist/`.
- **Duplicate `ImageLoadResult`**: Make sure `src/shared/types.ts` no longer has the local definition.

</details>
