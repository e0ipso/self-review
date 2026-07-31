---
id: 2
group: "npm-workspaces"
dependencies: [1]
status: "completed"
created: 2026-03-05
skills:
  - build-verification
  - testing
---
# Verify Builds and Tests

## Objective
Verify that workspace packages build correctly and all existing unit tests pass after the workspace configuration change.

## Skills Required
Build verification, testing

## Acceptance Criteria
- [ ] `npm run build --workspace=packages/core` succeeds
- [ ] `npm run build --workspace=packages/react` succeeds (resolves `@self-review/core` correctly)
- [ ] `npm run test:unit` passes (all existing Electron app tests unaffected)
- [ ] Electron app starts successfully (`npm start` boots without errors)

## Technical Requirements
- Build both workspace packages using npm workspace syntax
- Run full unit test suite
- Verify Electron Forge webpack resolution still works with hoisted dependencies

## Input Dependencies
- Task 01: npm workspaces configured, lock file regenerated, symlinks in place

## Output Artifacts
- Verification that builds succeed
- Verification that tests pass

## Implementation Notes
- Build `packages/core` first since `packages/react` depends on it
- If Electron app fails to start, check webpack module resolution — workspaces change the `node_modules` hoisting structure
- Unit tests run inside dev container; e2e tests do NOT (skip e2e)
