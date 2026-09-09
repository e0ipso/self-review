---
id: 2
group: "shared-engine-workspace-package"
dependencies: [1]
status: "completed"
created: 2026-09-04
skills:
  - nodejs
  - vitest
complexity_score: 4
execution_profile: "standard-implementation"
---
# Create the private engine workspace package

## Objective
Add `packages/engine` as a workspace package that is deliberately not
publishable, with its own test configuration, and wire it into the root
`test:unit` script so tests placed in it will actually run.

## Skills Required
`nodejs` for npm workspace and package manifest configuration; `vitest` for the
package-level test configuration mirroring `packages/core`.

## Acceptance Criteria
- [ ] `packages/engine/package.json` exists with `"name": "@self-review/engine"`, `"private": true`, `"version": "0.0.0"`, and no `publishConfig`, `exports`, `files`, `main`, `module` or `types` fields.
- [ ] `packages/engine/vitest.config.ts` and a `"test:unit": "vitest run"` script exist, mirroring `packages/core`.
- [ ] The root `package.json` `test:unit` script ends with `&& npm run test:unit --workspace @self-review/engine`.
- [ ] `npm install` completes and `ls -l node_modules/@self-review/engine` resolves to a symlink pointing at `packages/engine`.
- [ ] `npm run test:unit --workspace @self-review/engine` exits 0 (vitest reporting no test files is acceptable at this point).
- [ ] `grep -rn "engine" .releaserc.json .github/workflows/release.yml` returns no match.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
The package must remain absent from `.releaserc.json` (both the
`@semantic-release/npm` plugin list and the `@semantic-release/git` `assets`
array) and from the `for pkg in packages/types packages/core packages/react`
loop in `.github/workflows/release.yml`. Nothing resolves the package by name,
so it needs no entry-point fields at all.

## Input Dependencies
Task 1 must have recorded the baselines before this task modifies any file.

## Output Artifacts
An empty but wired `packages/engine` workspace that tasks 3, 4 and 5 move code
into.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Create `packages/engine/package.json`:
```json
{
  "name": "@self-review/engine",
  "version": "0.0.0",
  "private": true,
  "description": "Node-only engine layer for self-review: review handlers, startup mode, diff and guide loading, remote PR/MR handling",
  "type": "module",
  "scripts": {
    "test:unit": "vitest run"
  },
  "dependencies": {
    "@self-review/core": "*",
    "@self-review/types": "*"
  },
  "devDependencies": {
    "typescript": "~5.9.0",
    "vitest": "^4.0.18"
  },
  "license": "MIT"
}
```
2. Create `packages/engine/vitest.config.ts` modelled on `packages/core`'s. Read that file first and copy its shape; do not invent options it does not use.
3. Edit the root `package.json` `test:unit` script. It currently reads:
   `vitest run --config vitest.config.main.ts && vitest run --config vitest.config.renderer.ts && npm run test:unit --workspace @self-review/core`
   Append ` && npm run test:unit --workspace @self-review/engine`.
4. Run `npm install` to create the workspace symlink and update `package-lock.json`.
5. Do NOT add the package to `.releaserc.json` or the release workflow. Do NOT add a `tsup` build. Do NOT add a `main`/`exports` field — the desktop application reaches this package by deep relative source path, so entry-point metadata would be dead weight and would imply publishability the plan explicitly withholds.
6. Do not write the README here; task 7 owns documentation.
</details>
