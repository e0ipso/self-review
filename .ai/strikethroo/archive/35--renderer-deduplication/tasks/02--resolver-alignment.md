---
id: 2
group: "preparation"
dependencies: []
status: "pending"
created: "2026-03-11"
skills:
  - "typescript"
---
# Resolver Alignment for Package Source Imports

## Objective
Ensure `@self-review/core` and `packages/react/src` path resolution works consistently across webpack (Electron Forge bundler), TypeScript type-checking, and Vitest so that renderer code can import from package source without local shims.

## Skills Required
- TypeScript (tsconfig path aliases)

## Acceptance Criteria
- [ ] `@self-review/core` imports resolve correctly in webpack bundle (check Electron Forge webpack config)
- [ ] `@self-review/core` imports resolve correctly in TypeScript (`tsc --noEmit` passes without path errors)
- [ ] `@self-review/core` imports resolve correctly in root Vitest config and `packages/react` Vitest config
- [ ] A trivial import smoke-test (e.g., importing a type from `@self-review/core` in a renderer file) compiles and type-checks cleanly
- [ ] No new local shims or `../../shared/types` re-exports are introduced

## Technical Requirements
- Files to check/update:
  - `webpack.renderer.config.js` or equivalent Electron Forge webpack config
  - `tsconfig.json` and/or `tsconfig.renderer.json`
  - `vitest.config.ts` (root) and `packages/react/vitest.config.ts`
- The workspace `packages/core` is already imported by `src/main`; verify the same resolution mechanism works for renderer

## Input Dependencies
None — resolver alignment is a prerequisite for all other tasks.

## Output Artifacts
- Updated webpack, tsconfig, and vitest config files (only where changes are needed)
- Verified: `tsc --noEmit` passes, `npm run test:unit` passes after changes

## Implementation Notes

<details>
<summary>Resolution approach</summary>

1. Check how `src/main` currently resolves `@self-review/core` (look at `package.json` workspaces config and any webpack alias entries)
2. Verify the renderer webpack config includes the same alias or module resolution rule
3. Verify `tsconfig.json` `paths` or `baseUrl` covers `@self-review/core → packages/core/src`
4. Verify Vitest `resolve.alias` in root and package configs matches
5. Run `tsc --noEmit` and `npm run test:unit` to confirm no breakage
6. Do NOT add resolution for `packages/react/src` as a named alias — renderer will import from `packages/react/src/` via relative path or rely on the workspace package; only `@self-review/core` alias needs verification

The goal is to confirm existing resolution works (or add minimal config to make it work), NOT to introduce new build tooling.
</details>
