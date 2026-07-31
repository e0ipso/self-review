---
id: 1
group: "npm-workspaces"
dependencies: []
status: "completed"
created: 2026-03-05
skills:
  - npm-configuration
  - monorepo-setup
---
# Configure npm Workspaces and Fix Dependency Protocol

## Objective
Replace pnpm workspace configuration with npm-native workspaces and fix the pnpm-specific `workspace:*` dependency protocol.

## Skills Required
npm configuration, monorepo setup

## Acceptance Criteria
- [ ] Root `package.json` has `"workspaces": ["packages/*"]` field
- [ ] `pnpm-workspace.yaml` is deleted
- [ ] `packages/react/package.json` uses `"*"` instead of `"workspace:*"` for `@self-review/core`
- [ ] `npm install` succeeds and creates symlinks at `node_modules/@self-review/core` and `node_modules/@self-review/react`
- [ ] `package-lock.json` is updated to reflect workspace topology

## Technical Requirements
- Add `"workspaces"` field to root `package.json` (after `"description"` or similar top-level field)
- Remove `pnpm-workspace.yaml`
- Change `"@self-review/core": "workspace:*"` to `"@self-review/core": "*"` in `packages/react/package.json`
- Run `npm install` to regenerate lock file and create symlinks
- Verify symlinks exist: `ls -la node_modules/@self-review/`

## Input Dependencies
None (first task)

## Output Artifacts
- Updated root `package.json` with workspaces field
- Updated `packages/react/package.json` with npm-compatible dependency
- Regenerated `package-lock.json`
- Symlinked workspace packages in `node_modules`

## Implementation Notes
- npm workspaces field goes in root `package.json` as a top-level field
- `"*"` version range is resolved to local package by npm because the workspace symlink satisfies any version
- The lock file diff will be large — this is expected and unavoidable
